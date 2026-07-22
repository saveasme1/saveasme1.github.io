# 헤리티지 포트폴리오 관리자

## 접속

- 운영: `https://hand-made.kr/admin/`
- 고유 진입: `https://hand-made.kr/gb171-admin.html`
- 직접 파일: `https://hand-made.kr/admin/index.html`
- MakerBridge 관리자 계정 필요
- GitHub Fine-grained PAT는 MakerBridge 서버 `.env`에만 보관하며 브라우저로 전달하지 않는다.

## 작업 흐름

1. MakerBridge 관리자 아이디·비밀번호로 접속
2. 승인 대기 회원을 승인 또는 거절
3. 새 게시글 작성 또는 기존 게시글 선택
4. 카테고리·게시일·제목·내용·대표 이미지·추가 이미지를 편집
5. **저장하기**
6. 목록 체크박스로 여러 게시글 선택 → 이동·복사·삭제
7. 상단 **미리보기**에서 PDF와 같은 표지·3×3 목록·2×2 상세 페이지 확인
8. 상단 **포트폴리오 배포하기**

초안 저장만으로 공개 포트폴리오는 바뀌지 않는다. 배포하기가 성공해야 `portfolio-data.json`이 갱신되고, 이후 PDF 다운로드에 반영된다. 제목·내용은 목록 그리드에, 추가 이미지는 상품별 2×2 상세 페이지에 들어간다.

관리자 저장·배포 JSON은 공백 없이 전송하고, 공개 manifest는 PDF에 필요한 필드만 포함한다. 이미지 파일은 배포 시 재업로드하지 않으므로 배포 요청은 manifest 1개만 갱신한다.

## 데이터 파일

- `portfolio-draft.json`: 관리자 작업본
- `portfolio-data.json`: 공개·PDF용 배포본
- `portfolio/seed/`: Imweb에서 이관한 대표 이미지
- `portfolio/details/{imweb-id}/`: Imweb 게시글 본문에서 이관·압축한 추가 이미지
- `portfolio/uploads/{item-id}/`: 관리자 업로드 이미지

게시글은 `image`/`cover`(대표 이미지), `images[]`(추가 이미지), `title`, `content`, `category`, `uploadedAt`, `sortAt`을 가진다. 공개/PDF 정렬은 `sortAt` 최신순이다.

삭제는 먼저 초안 목록에서만 제거된다. 배포 후 공개 데이터에서 제거된다. Git 히스토리와 기존 배포본 보호를 위해 이미지 파일 자체는 즉시 삭제하지 않는다.

## Imweb 추가 이미지 갱신

```bash
npm install
npm run hydrate-details
```

게시글 본문의 제품 이미지를 최대 760px JPEG로 압축해 `portfolio/details/`에 저장하고 초안·공개 manifest의 `images[]`에 연결한다. 카카오 QR/상담 링크 이미지는 제외한다. 전체 대표 이미지까지 다시 수집하려면 `npm run crawl`을 사용한다.

## 주의

- 저장소가 public이므로 `portfolio-draft.json`과 업로드 이미지는 URL을 아는 사람에게 공개될 수 있다.
- 두 관리자가 동시에 저장하면 GitHub SHA 충돌이 발생할 수 있다. 이 경우 새로고침 후 다시 작업한다.
- 관리자 비밀번호나 서버 PAT가 노출되면 즉시 비밀번호 해시 교체/PAT revoke를 수행한다.
