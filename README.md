# Self - Personal Bookmark & Share App

Self는 개인용 북마크 및 공유 앱입니다. PWA로 구현되어 Android의 공유 인텐트를 통해 쉽게 텍스트, 링크, 이미지, 영상, 파일을 저장할 수 있습니다.

## 🌐 도메인

- **Production**: https://self.huny.dev

## ✨ 기능

- **간편한 저장**: 텍스트, 링크, 이미지, 영상, 파일을 드래그 앤 드롭 또는 붙여넣기로 저장
- **PWA 공유**: Android에서 공유하기 메뉴에 Self가 표시되어 빠르게 저장 가능
- **태그/레이블**: 항목을 태그로 분류하여 정리
- **그리드 피드**: 날짜별로 분류된 썸네일 뷰

## 🛠 기술 스택

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Cloudflare Workers + Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (파일 저장)

## 📦 설치 및 실행

### 필수 요구사항

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare 계정

### 로컬 개발

```bash
# 의존성 설치
npm install

# D1 데이터베이스 마이그레이션 (로컬)
npm run db:migrate

# Worker 개발 서버 실행 (포트 8787)
npm run dev:worker

# 다른 터미널에서 Vite 개발 서버 실행 (포트 3000)
npm run dev
```

### 배포

```bash
# R2 버킷 생성 (최초 1회)
npm run r2:create

# D1 마이그레이션 적용 (원격)
npm run db:migrate:remote

# 배포
npm run deploy
```

## 🗄 데이터베이스 스키마

### Items 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | Primary key (UUID) |
| type | TEXT | text, link, image, video, file |
| content | TEXT | 텍스트 내용 또는 URL |
| file_key | TEXT | R2 저장 키 |
| file_name | TEXT | 원본 파일명 |
| file_size | INTEGER | 파일 크기 (bytes) |
| mime_type | TEXT | MIME 타입 |
| title | TEXT | 제목 (선택) |
| created_at | INTEGER | 생성 시간 (Unix ms) |

### Tags 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | Primary key (UUID) |
| name | TEXT | 태그 이름 (Unique) |
| color | TEXT | 태그 색상 |
| created_at | INTEGER | 생성 시간 (Unix ms) |

### Item_Tags 테이블 (다대다 관계)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| item_id | TEXT | Items FK |
| tag_id | TEXT | Tags FK |

## 📱 PWA & Share Target

Self는 Web Share Target API를 사용하여 Android의 공유 인텐트를 지원합니다.

### 지원 포맷
- `text/plain` - 텍스트 및 URL
- `image/*` - 모든 이미지 형식
- `video/*` - 모든 영상 형식
- `application/*` - 파일

### 설치 방법 (Samsung Browser)
1. self.huny.dev 접속
2. 메뉴 → "홈 화면에 추가"
3. 설치 완료 후 앱에서 공유하기 시 "Self" 선택 가능

## 🔧 환경 설정

### wrangler.toml
```toml
name = "self"
main = "worker/src/index.ts"
compatibility_date = "2024-11-01"

[site]
bucket = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "self"
database_id = "f19650fd-8825-4829-96e6-cf580aca86d2"
migrations_dir = "worker/migrations"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "self-files"
```

## 📂 프로젝트 구조

```
/workspace/
├── worker/                 # Cloudflare Workers 백엔드
│   ├── src/
│   │   ├── index.ts       # 메인 엔트리포인트
│   │   └── routes/        # API 라우트
│   │       ├── items.ts   # 아이템 CRUD
│   │       ├── tags.ts    # 태그 CRUD
│   │       ├── upload.ts  # 파일 업로드
│   │       └── share.ts   # 공유 타겟 처리
│   └── migrations/        # D1 마이그레이션
├── components/            # React 컴포넌트
├── services/              # 프론트엔드 서비스
├── public/                # 정적 파일
│   ├── manifest.json      # PWA 매니페스트
│   ├── sw.js              # Service Worker
│   └── icons/             # PWA 아이콘
├── wrangler.toml          # Workers 설정
└── package.json
```

## 📜 라이센스

MIT License
