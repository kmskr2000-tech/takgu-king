# Technical Preferences

<!-- project.yaml at the repo root is the machine-readable source of truth for
     engine, specialists, naming, performance, platform, and testing.framework.
     This file is the human-readable LEGACY FALLBACK: agents and skills resolve
     each key from project.yaml first and fall back here only when the
     project.yaml key is absent. /setup-engine dual-writes both.
     Forbidden patterns and allowed libraries are NOT migrated — they live only
     in this file. Populated by /setup-engine; updated as decisions are made. -->

## Engine & Language

- **Engine**: Godot 4.4 (프로젝트 pin). 로컬 에디터는 4.6 — 4.4.1 설치 여부 미확정 (ADR-001)
- **Language**: GDScript
- **Rendering**: GL Compatibility, 480×270 정수 배율 픽셀 퍼펙트, HD-2D 후처리
- **Physics**: 자체 발밑(footprint) 좌표 + 충돌 지도 (Godot 물리 엔진 미사용)

## Input & Platform

<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: Web(GitHub Pages), Android(후보)
- **Input Methods**: Touch + Keyboard(개발용)
- **Primary Input**: Touch (가로 화면, 왼쪽 플로팅 조이스틱 + 오른쪽 버튼)
- **Gamepad Support**: None
- **Touch Support**: Full
- **Platform Notes**: [TO BE CONFIGURED — any platform-specific UX constraints]

## Naming Conventions

- **Classes**: [TO BE CONFIGURED]
- **Variables**: [TO BE CONFIGURED]
- **Signals/Events**: [TO BE CONFIGURED]
- **Files**: [TO BE CONFIGURED]
- **Scenes/Prefabs**: [TO BE CONFIGURED]
- **Constants**: [TO BE CONFIGURED]

## Performance Budgets

- **Target Framerate**: 60 (모바일 웹 최저 30 허용)
- **Frame Budget**: [TO BE CONFIGURED]
- **Draw Calls**: [TO BE CONFIGURED]
- **Memory Ceiling**: [TO BE CONFIGURED]

## Testing

- **Framework**: 없음 (`--capture` 하네스 + 웹판 Playwright). GUT 도입 여부는 ADR-001
- **Minimum Coverage**: [TO BE CONFIGURED]
- **Required Tests**: Balance formulas, gameplay systems, networking (if applicable)

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- 외부 에셋 사용 금지(CC0/MIT 확인 전). 도트·사운드는 전부 코드 생성(art/*.py)
- 조선 시대 복식(갓·도포) 신규 사용 금지 — 신라 복식 규칙(복두·관모·직령/단령)

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->
- [None configured yet — add as dependencies are approved]

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [No ADRs yet — use /architecture-decision to create one]

## Engine Specialists

<!-- Written by /setup-engine when engine is configured. -->
<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: [TO BE CONFIGURED — run /setup-engine]
- **Language/Code Specialist**: [TO BE CONFIGURED]
- **Shader Specialist**: [TO BE CONFIGURED]
- **UI Specialist**: [TO BE CONFIGURED]
- **Additional Specialists**: [TO BE CONFIGURED]
- **Routing Notes**: [TO BE CONFIGURED]

### File Extension Routing

<!-- Skills use this table to select the right specialist per file type. -->
<!-- If a row says [TO BE CONFIGURED], fall back to Primary for that file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (primary language) | [TO BE CONFIGURED] |
| Shader / material files | [TO BE CONFIGURED] |
| UI / screen files | [TO BE CONFIGURED] |
| Scene / prefab / level files | [TO BE CONFIGURED] |
| Native extension / plugin files | [TO BE CONFIGURED] |
| General architecture review | Primary |
