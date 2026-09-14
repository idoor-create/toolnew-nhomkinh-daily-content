# Flow hien tai — Content Lab, Google Sheet va anh nhom kinh

**Ngay cap nhat:** 2026-09-12  
**Pham vi:** Tool quan ly noi dung cho nhom kinh Xingfa Tien Giang, Content Lab, Google Sheet SEO, anh nguon/anh that, va flow server tao nhap AI.

---

## 1. Muc tieu hien tai

Tool dang huong toi mot flow lam noi dung SEO + Facebook/TikTok cho dich vu cua nhom kinh tai mien Nam, mien Tay:

1. Lay bai nguon co tin hieu tot tu Facebook/TikTok/Instagram/nguon khac.
2. Uu tien link nguon that, anh that, anh cong trinh that; tranh URL tam het han nhu `fbcdn/scontent` co `_nc_` hoac hash.
3. Luu nguon vao Content Lab theo tung ho so khach hang.
4. AI chi hoc hook, cau truc, goc noi dung; khong copy caption va khong bia gia/bao hanh/cong trinh.
5. Xuat mot dong noi dung dung format Google Sheet hien tai, dung 17 cot, khong them tab/cot moi.
6. Cot `image` can la URL on dinh, co the hien thi duoc trong Google Sheet.
7. Noi dung tap trung vao noi dau khach hang mien Nam/mien Tay: cua xeo, ray keu, mua tat, silicon ho, khoa/ban le yeu, bao gia khong ro, lap dat cham/ban.
8. Truoc khi luu nhap phai validate link nguon, link anh, hashtag, va noi dau khach co bi trung cac dong gan nhat hay khong.

---

## 2. Tai khoan va file dang dung

| Hang muc | Gia tri hien tai |
|---|---|
| Google Sheet | `toolss` |
| Spreadsheet ID | `19nSL3_mrZ9XmaIVabHCXBpd75DgmaYW2n6BpADWXGcw` |
| Tab | `SEO_nhomkinh` |
| Gmail user muon dung | `tranducvuht@gmail.com` |
| Fanpage | `https://www.facebook.com/cuanhomkinhxingfatiengiang` |
| Zalo trong noi dung | `089 999 2618` |

Ghi chu: neu dung Google Drive connector trong Codex, can kiem tra lai tai khoan dang ket noi truoc khi sua file vi connector co the dang la mot Gmail khac. Sheet da duoc share writer cho `tranducvuht@gmail.com`.

---

## 3. Cot Google Sheet hien tai

Sheet hien tai chi giu cac cot sau:

```text
thoi_gian
tu_khoa_chinh
tu_khoa_phu
y_dinh_tim_kiem
title_seo
meta_description
h1
slug
dan_y
noi_dung_seo
caption_tiktok
caption_facebook
kich_ban_video
hashtag
link_nguon
image
noi_dau_khach
```

Da bo cac cot nay:

```text
facebook_status
facebook_post_id
facebook_post_url
facebook_posted_at
facebook_error
anh_nguon
anh_goc
giong_mien
review_status
```

Ly do bo:

- Trang thai dang Facebook khong nam trong Sheet SEO nua; viec publish/log nen thuoc module post scheduler.
- `anh_nguon` va `anh_goc` duoc gom ve logic nguon/anh trong Content Lab, con Sheet chi can cot `image` de hien thi anh dung cho bai.
- `giong_mien` da duoc dua vao prompt mac dinh: viet tu nhien cho mien Nam/mien Tay, khong can cot rieng.
- `review_status` chua can trong format Sheet hien tai.

---

## 4. Flow du lieu tong quat

```text
Nguon viral / bai that / fanpage that
  -> Lay link bai cu the, khong lay link homepage chung chung neu co link post
  -> Lay anh that, tranh link CDN tam
  -> Upload anh on dinh len Google Drive neu can
  -> Luu vao Content Lab theo customer
  -> Chon 1-8 nguon tot
  -> Backend lay 5-10 noi_dau_khach gan nhat tu ContentDraft de tranh lap
  -> Nhap keyword, y dinh tim kiem, business context, anh uu tien
  -> Backend goi AI
  -> AI tra ve JSON dung 17 cot Sheet
  -> Backend validate 17 cot, link nguon cu the, anh on dinh, hashtag 3-6, noi dau khong trung
  -> Luu ContentDraft trong SQLite
  -> UI hien nhap va cho copy mot dong TSV dung thu tu 17 cot sang Google Sheet
  -> Google Sheet cot image hien thi anh bang URL on dinh/IMAGE()
```

---

## 5. Flow anh dung chuan

Anh trong cot `image` can di theo nguyen tac:

1. Uu tien anh cong trinh that cua minh.
2. Neu lay anh viral/tham khao, phai co link nguon that va khong nhan la cong trinh cua minh.
3. Khong dung URL `scontent`, `fbcdn`, URL co `_nc_`, URL co hash/expire vi se bi loi `Bad URL hash` hoac het han.
4. Neu anh tren Facebook khong ben, tai anh ve va upload lai len Drive cua file lam viec.
5. Neu can chen thong tin doanh nghiep len anh, tao ban anh moi co overlay:

```text
Cua Nhom Kinh Xingfa Tien Giang
Zalo 089 999 2618
facebook.com/cuanhomkinhxingfatiengiang
```

6. Anh da overlay duoc upload lai len Drive va cot `image` tro toi file moi.
7. Trong Google Sheet, neu dung cong thuc `IMAGE()`, phai bam `Cho phep truy cap` khi Sheet bao cong thuc dang lay du lieu tu ben ngoai.

Trang thai hien tai da lam:

- Sheet da duoc bat quyen `Cho phep truy cap` trong trinh duyet cua `tranducvuht@gmail.com`.
- Cot `image` da tung duoc set bang cong thuc `IMAGE(...)` va note thong tin doanh nghiep.
- Can tiep tuc chot cach hien thi on dinh nhat: upload anh overlay len Drive va dung URL anh co the fetch truc tiep.

---

## 6. Flow Content Lab trong app

### Them bai nguon

UI: `frontend/src/pages/ContentLabPage.tsx`

Nguoi dung nhap:

- Ho so/customer.
- Platform: `facebook`, `tiktok`, `instagram`, `other`.
- Ten/chude bai nguon.
- Link bai nguon.
- Anh nguon URL.
- Anh goc/cong trinh URL.
- Views, reactions, comments.
- Notes ve hook, goc noi dung, diem viral.

Backend validate bang `referenceSchema` trong:

```text
backend/src/modules/content/content.service.ts
```

API:

```text
GET  /api/content/references?customerId=
POST /api/content/references
```

Quy tac chan dau vao:

- `sourceUrl` phai la link bai/post/video/bai viet cu the; khong dung link thu vien nhu `/photos`, `/videos`, `/posts` neu chua co ID bai cu the.
- Khong nhan link anh co `scontent`, `fbcdn`, `_nc_`, expiry/hash/token.
- Neu gap link anh Facebook tam, phai upload anh ve Drive/server on dinh roi moi luu.

### Tao nhap AI

Nguoi dung chon 1-8 nguon, nhap:

- Tu khoa chinh.
- Tu khoa phu.
- Y dinh tim kiem.
- Business context.
- Anh goc uu tien neu co.

API:

```text
GET  /api/content/drafts?customerId=
POST /api/content/generate
```

Backend goi OpenAI-compatible endpoint:

```text
POST {AI_BASE_URL}/chat/completions
model = AI_MODEL
api key = AI_API_KEY hoac OPENAI_API_KEY
```

Ket qua AI phai la JSON dung 17 cot Sheet. Neu thieu/sai field, backend tra loi `AI_RESPONSE_INVALID`.

Backend hien validate them:

- 17 field dung format, khong co field thua.
- `link_nguon` la link cu the, khong phai homepage/fanpage.
- `image` khong phai link tam.
- `hashtag` co 3-6 hashtag.
- `noi_dau_khach` khong trung voi 10 nhap gan nhat cua cung customer.
- `title_seo`, `meta_description`, `slug`, `dan_y`, `noi_dung_seo`, `caption_tiktok`, va `kich_ban_video` dung gioi han/format da quy dinh.

---

## 7. Quy tac 17 cot bat buoc

Backend yeu cau AI tra ve dung 17 field sau va khong du field thua. Moi field co luat rieng:

| Cot | Quy tac hien tai |
|---|---|
| `thoi_gian` | Bat buoc `YYYY-MM-DD HH:mm`, backend tu gan gio hien tai neu khong co gio len lich. |
| `tu_khoa_chinh` | Dich vu + dia phuong cu the, xoay vong My Tho, Go Cong, Cai Lay, Chau Thanh, Tien Giang. |
| `tu_khoa_phu` | 3-5 tu khoa lien quan truc tiep toi `noi_dau_khach`. |
| `y_dinh_tim_kiem` | Chi chon 1 trong 3: `tim hieu van de`, `so sanh gia`, `tim tho sua gap`. |
| `title_seo` | Co keyword + diem thuc dung, duoi 65 ky tu. |
| `meta_description` | 150-160 ky tu, noi dau + huong xu ly, khong viet chung chung. |
| `h1` | Cung y voi title nhung tu nhien hon, khong copy y nguyen. |
| `slug` | Lowercase ASCII, gach ngang, dung noi dung. |
| `dan_y` | 3-5 y ngan dang bullet/so thu tu, khong viet thanh doan van. |
| `noi_dung_seo` | 300-500 tu, co it nhat 1 giai thich ky thuat that. |
| `caption_tiktok` | Ngan, cau dau la hook noi dau, nhip noi duoc, toi da khoang 150 tu. |
| `caption_facebook` | Dong dau la hook noi dau, CTA hoi dia diem, rong x cao, huong mo, anh/video hien trang. |
| `kich_ban_video` | Tach moc giay: Hook 0-3s -> Problem 3-10s -> Solution 10-20s -> CTA. |
| `hashtag` | 3-6 hashtag dia phuong/van de, khong dung mot bo lap co dinh. |
| `link_nguon` | Link post/video/bai viet cu the, khong homepage/fanpage/thu vien `/photos` chung chung. |
| `image` | Link on dinh, uu tien Drive direct view; cam `scontent`, `fbcdn`, `_nc_`, token/expire/hash tam. |
| `noi_dau_khach` | Mot cau van de cu the co the quan sat, lay cam hung tu nguon that. |

AI con duoc yeu cau:

- Viet tieng Viet cho nguoi mua mien Nam/mien Tay.
- Khong bat chuoc phuong ngu qua lo.
- Khong sao chep caption nguon.
- Khong bia gia, bao hanh, chung nhan, feedback, cong trinh, toc do thi cong.
- Uu tien giai thich ky thuat co the kiem chung: do o cho, ray, ban le, khoa, silicon, lo thoat nuoc, do day nhom/kinh.
- CTA can hoi thong tin that, khong chi viet `Lien he ngay`.

Noi dau nen uu tien:

```text
cua xeo, cua keu, ray truot nang, mua tat, silicon ho,
khoa long, ban le yeu, kinh/nhom sai do day,
bao gia khong tach vat tu, mau catalogue khac mau thuc te,
thi cong cham, lap xong ban va kho bao tri
```

CTA nen hoi thong tin that:

```text
gui rong x cao
huong mo cua
vi tri lap tai My Tho / Tien Giang / Go Cong / Cai Lay
anh hoac video hien trang
```

---

## 8. Flow server va publish social

Module content hien tai chi tao nhap noi dung, chua dang that len Facebook/TikTok.

Module publish nam o phan posts/integrations:

```text
backend/src/modules/posts
backend/src/modules/integrations/facebook.service.ts
backend/src/modules/integrations/tiktok.service.ts
```

Ranh gioi nen giu:

- Content Lab: crawl/nhap nguon, tao content, xuat Sheet.
- Google Sheet: bang SEO va noi dung duyet.
- Posts scheduler: tao bai, len lich, publish, log loi/thanh cong.
- Facebook/TikTok integrations: OAuth/token/API publish.

Khong nen dua cac cot `facebook_status`, `facebook_error` quay lai Sheet SEO neu chua co nhu cau theo doi publish tai Sheet. Neu can theo doi publish, nen dung bang `posts`/`post_logs`.

---

## 9. Checklist truoc khi dua vao Sheet

- Link nguon la link that, khong phai link chung chung neu co post cu the.
- Anh trong `image` khong phai URL tam.
- Anh co the hien thi trong Google Sheet.
- Neu anh cua minh: co the dong thong tin/Zalo/fanpage len anh.
- Neu anh tham khao: khong viet nhu cong trinh cua minh.
- Caption Facebook co hook noi dau dau dong.
- Noi dung SEO co thong tin huu ich cho nguoi tim kiem, khong chi ban hang.
- Hashtag 3-6 cai, khong lap.
- Slug lowercase ASCII, co dau gach ngang.
- Copy tu UI phai la mot dong TSV dung thu tu 17 cot, dan thang vao dong moi cua Google Sheet.
- Khong co thong tin gia/bao hanh/cam ket neu chua xac minh.

---

## 10. Viec can lam tiep

1. Chot cach tao anh overlay tu anh goc va upload lai Drive.
2. Cap nhat cot `image` bang URL anh overlay on dinh.
3. Neu Google Sheet van khong hien anh, can doi sang link public/fetchable hoac co mot endpoint proxy anh cua server.
4. Them tool import/export Sheet de khong phai copy tay tu nhap AI.
5. Tach ro bang log publish neu sau nay muon theo doi Facebook/TikTok trong app.
6. Kiem tra lai `.env`: khong de lo API key, neu key da tung public thi phai rotate.
