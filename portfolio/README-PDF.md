# Interactive Portfolio PDF

- Static download: `/portfolio/portfolio-latest.pdf`
- Meta / cache bust: `/portfolio/portfolio-meta.json`
- Built by MakerBridge `handmadePortfolioPdfService` on each admin **포트폴리오 배포하기**
- Mobile page size with internal `goTo` links (home → brand categories → product list → detail)
- Newest-first sort uses `sortAt` → `uploadedAt` → `createdAt` (not update time)
- Failed builds keep the previous PDF (atomic temp rename + GitHub publish after validation)
