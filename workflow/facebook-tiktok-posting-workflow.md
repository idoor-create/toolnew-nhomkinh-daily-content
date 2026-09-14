# Workflow he thong quan ly lich dang bai Facebook & TikTok

**Ngay:** 2026-09-01  
**Trang thai:** Da ra soat, san sang lam implementation Phase 1  
**Doi tuong su dung:** Agency noi bo, nhan vien quan ly nhieu khach hang

---

## 1. Quyet dinh da chot

| Muc | Quyet dinh |
|-----|------------|
| San pham | He thong quan ly lich dang bai cho Facebook va TikTok |
| Nguoi dung | Nhan vien agency dang nhap va quan ly nhieu customer |
| Stack Phase 1 | Node.js, Express, TypeScript, Prisma, SQLite, JWT |
| Database sau nay | Giu Prisma schema gan voi Postgres de migrate de hon |
| Phase 1 lam gi | Auth, users, customers, posts, seed admin, CRUD API |
| Phase 1 chua lam | Upload, scheduler, OAuth, publish that, webhook, email |
| Facebook | Dung Meta Graph API chinh thuc |
| TikTok | Dung Ayrshare hoac Buffer, khong tu dong hoa browser |
| Khong lam | Puppeteer, gia lap dang nhap, luu mat khau Facebook/TikTok cua khach |

---

## 2. Nguyen tac an toan bat buoc

- Khong tu dong hoa trinh duyet de dang nhap hoac dang bai Facebook/TikTok.
- Khong luu mat khau Facebook/TikTok cua khach tren he thong.
- Facebook phai di qua OAuth, Graph API va App Review khi can quyen Page.
- TikTok SME nen di qua doi tac duoc cap phep nhu Ayrshare hoac Buffer.
- Token Facebook va Ayrshare profile key phai ma hoa at-rest tu Phase 2/3 tro di.
- Phase 1 co the tao cot token trong DB nhung API public khong nhan va khong tra secret.
- Customer that phai co co che ket noi kenh: Facebook OAuth de lay Page, TikTok qua Ayrshare/Buffer profile.

---

## 3. Workflow tong quat

He thong co 2 luong lon:

1. **Onboarding customer:** thuc hien mot lan cho moi khach hang.
2. **Vong doi bai viet:** tao, len lich, dang bai, ghi log, thong bao.

Phase 1 chi lam phan vong doi bai viet o muc luu DB va CRUD API. Chua co scheduler va chua dang that len Facebook/TikTok.

```text
BUOC 0 - ONBOARDING CUSTOMER (Phase 2-3)
  Nhan vien tao customer tren app
  -> Khach cap quyen Facebook Page qua OAuth
  -> Backend lay danh sach Fanpage duoc cap quyen
  -> Khach/agency chon Fanpage muc tieu cho tung bai dang
  -> Khach ket noi TikTok tren Ayrshare/Buffer
  -> Backend luu page_id, page token, ayrshare profile key
  -> Secret duoc ma hoa truoc khi luu DB

BUOC 1 - TAO BAI (Phase 1 API, Phase 4 UI)
  Nhan vien chon customer
  -> Nhap title, content, hashtags, platforms, mediaUrls, scheduledTime
  -> Validate du lieu
  -> Luu post voi status draft hoac scheduled

BUOC 2 - LEN LICH (Phase 5)
  Post co status scheduled
  -> Worker tao delayed job
  -> Khi sua gio hoac xoa bai, job cu phai duoc huy/cap nhat

BUOC 3 - DEN GIO PUBLISH (Phase 2-3 + Phase 5)
  Worker lay post den gio
  -> Dang Facebook bang Graph API
  -> Dang TikTok bang Ayrshare/Buffer
  -> Dung Promise.allSettled de mot kenh loi khong chan kenh con lai

BUOC 4 - GHI LOG (Phase 5)
  Moi platform co mot dong post_logs
  -> Thanh cong: luu externalPostId, externalUrl
  -> That bai: luu errorMessage
  -> Tat ca fail: post.status = failed
  -> Mot kenh ok, mot kenh fail: post.status = partial

BUOC 5 - THONG BAO (Phase 5+)
  Dashboard hien ket qua dang bai
  -> Email tuy chon
  -> Token het han: customer.facebookReconnectRequired = true
```

---

## 4. Trang thai bai viet

| Status | Y nghia | Phase |
|--------|---------|-------|
| `draft` | Bai dang nhap, chua len lich | Phase 1 |
| `scheduled` | Bai da co gio dang | Phase 1 |
| `published` | Tat ca platform can dang da thanh cong | Phase 5 |
| `failed` | Tat ca platform can dang deu that bai | Phase 5 |
| `partial` | Dang nhieu platform, co kenh thanh cong va co kenh that bai | Phase 5 |

Quy tac Phase 1:

- API client chi duoc tao/sua `draft` va `scheduled`.
- Client khong duoc set `published`, `failed`, `partial`.
- `published`, `failed`, `partial` de worker publish cap nhat o Phase 5.

---

## 5. Validate nghiep vu

### Customer

- `name` bat buoc, khong duoc rong.
- Khong tra `facebookToken` va `ayrshareProfileKey` trong response.
- Xoa customer khi con post phai bi chan bang `409 Conflict`.

### Post

- `customerId` bat buoc va phai ton tai.
- `content` bat buoc, trim xong khong duoc rong.
- `platforms` bat buoc la array khong rong.
- `platforms` chi duoc gom `facebook`, `tiktok`.
- `mediaUrls` la array string URL hop le.
- Phase 1 SQLite luu `platforms` va `mediaUrls` duoi dang JSON string trong DB; API van nhan/tra array. Khi migrate Postgres co the doi sang Prisma `Json`.
- Neu co `tiktok` trong `platforms`, Phase 1 yeu cau `mediaUrls` khong rong.
- `status` chi nhan `draft` hoac `scheduled` trong Phase 1.
- Neu `status = scheduled`, `scheduledTime` bat buoc, la ISO-8601, va khong o qua khu.
- Moi DateTime luu UTC. UI sau nay tu convert theo timezone hien thi.

---

## 6. Facebook workflow chi tiet

Phase 2 moi implement.

1. Tao Meta App va cau hinh Facebook Login.
2. Xin quyen toi thieu theo docs Meta tai thoi diem implement, du kien:
   - `pages_show_list`
   - `pages_manage_posts`
   - `pages_read_engagement`
3. User token ngan han doi sang long-lived user token.
4. Lay Page access token long-lived tu Page duoc cap quyen.
5. Luu Page ID va Page token da ma hoa.
6. Publish:
   - Text: `POST /{page-id}/feed`
   - Anh: `POST /{page-id}/photos`
   - Video: `POST /{page-id}/videos`
7. Neu token het han hoac bi revoke, set `facebookReconnectRequired = true`.

---

## 7. TikTok workflow chi tiet

Phase 3 moi implement.

1. Khach ket noi TikTok tren Ayrshare hoac Buffer.
2. Agency luu profile key cua customer trong backend.
3. Profile key phai duoc ma hoa at-rest.
4. Publish qua API doi tac, vi du Ayrshare:

```text
POST https://api.ayrshare.com/api/post
platforms: ["tiktok"]
profileKeys: [...]
mediaUrls: [...]
```

5. Truoc khi schedule, can validate video theo gioi han hien hanh cua Ayrshare/TikTok.
6. Khong parse HTML TikTok, khong dung cookie session.

---

## 8. Phase roadmap

| Phase | Noi dung | Uoc luong |
|-------|----------|-----------|
| 1 | Auth, Prisma, SQLite, CRUD customers/posts | 3-5 ngay |
| 2 | Facebook OAuth va publish | 2-3 ngay + cho App Review |
| 3 | TikTok qua Ayrshare/Buffer | 1-2 ngay |
| 4 | Calendar UI, preview, upload media | 3-4 ngay |
| 5 | Scheduler, worker, post_logs, dashboard notification | 2 ngay |
| 6 | Test tong, deploy, monitoring | 2-3 ngay |

---

## 9. Rui ro va cach giam thieu

| Rui ro | Cach giam thieu |
|--------|-----------------|
| Meta App Review cham | Xin quyen som, lam song song voi Phase 1-4 |
| Token Facebook het han | Long-lived token, refresh/check job, flag reconnect |
| TikTok khong co API SME pho thong | Dung Ayrshare/Buffer |
| TikTok bat buoc video | Validate media tu Phase 4 |
| Scheduler tao job ma | Phase 1 chi luu DB; Phase 5 moi tao job va co logic update/cancel |
| Nhieu job trung gio | Dung queue nhu BullMQ + Redis khi scale |
| SQLite lock khi nhieu instance | Phase dau chay mot backend process; scale thi migrate Postgres |

---

## 10. Ket luan

Workflow hien tai da ok de bat dau Phase 1. Diem quan trong nhat la giu dung ranh gioi:

- Phase 1 chi lam backend CRUD noi bo.
- Khong dang that len social.
- Khong luu secret qua API public.
- Chuong trinh duoc thiet ke de Phase 2-5 gan OAuth, Ayrshare, scheduler va log vao ma khong phai dap di lam lai.
