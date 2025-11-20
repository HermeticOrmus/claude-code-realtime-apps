# Ready-To-Use Repository Build Prompts

**Quick Copy-Paste Prompts** for building out HermeticOrmus repositories using the integrated agent system.

See [SELF_BUILDING_STRATEGY.md](SELF_BUILDING_STRATEGY.md) for the complete framework.

---

## Universal Self-Build Prompt

**Copy this into any repository:**

```
Using the 85 specialized AI agents, 63 focused plugins, and 47 progressive disclosure skills now available in this repository, build this into a complete, production-ready project.

Phase 1 - Analyze:
- Repository name and purpose
- Existing content
- Technology stack
- Missing components

Phase 2 - Plan:
- Select relevant agents and workflows
- Design architecture
- Create implementation roadmap

Phase 3 - Build:
- Implement systematically
- Test continuously
- Document thoroughly
- Verify security

Transform this repository into production-ready state with comprehensive documentation, tests, security hardening, and deployment automation.
```

---

## Repository-Type Specific Prompts

### 1. Python FastAPI Microservice

```
Build this repository into a production-ready FastAPI microservice.

Use agents:
- python-pro (Sonnet) - Python best practices
- fastapi-pro (Sonnet) - FastAPI patterns
- database-architect (Opus) - Schema design

Activate skills:
- async-python-patterns
- python-testing-patterns
- uv-package-manager
- api-design-principles

Build:
1. /python-development:python-scaffold fastapi-microservice
2. Complete API implementation with async patterns
3. Database integration with SQLAlchemy/Tortoise ORM
4. Comprehensive test suite (pytest)
5. Docker containerization
6. /security-scanning:security-hardening
7. /cicd-automation:workflow-automate
8. /code-documentation:doc-generate

Deliverables:
- FastAPI app with OpenAPI docs
- Database models and migrations
- 90%+ test coverage
- Dockerfile + docker-compose
- GitHub Actions CI/CD
- Complete README with quick start
```

### 2. React Frontend Application

```
Build this repository into a production-ready React application.

Use agents:
- frontend-developer (Sonnet) - React architecture
- typescript-pro (Sonnet) - Type safety
- ui-ux-designer (Sonnet) - Interface design

Activate skills:
- typescript-advanced-types
- modern-javascript-patterns
- nodejs-backend-patterns (if SSR)

Build:
1. /javascript-typescript:typescript-scaffold {repo_name}
2. Component architecture with React hooks
3. State management (Context API or Zustand)
4. Routing with React Router
5. API integration layer
6. /unit-testing:test-generate (Jest + React Testing Library)
7. /frontend-mobile-security:xss-scan
8. Build optimization and code splitting
9. /code-documentation:doc-generate

Deliverables:
- React app with TypeScript
- Responsive component library
- 80%+ test coverage
- Vite/Webpack config optimized
- ESLint + Prettier setup
- Storybook for components
- Complete documentation
```

### 3. Full-Stack SaaS Application

```
Build this repository into a complete production-ready SaaS application with authentication, payments, and deployment.

Use multi-agent orchestration:
/full-stack-orchestration:full-stack-feature "complete SaaS platform with user authentication, subscription payments, and analytics"

This coordinates 7+ agents:
1. backend-architect → API design with auth endpoints
2. database-architect → User, subscription, payment schemas
3. frontend-developer → React dashboard and auth flows
4. payment-integration → Stripe/PayPal integration
5. test-automator → E2E test suite
6. security-auditor → OWASP + PCI compliance
7. deployment-engineer → Docker + Kubernetes
8. observability-engineer → Logging + monitoring

Activate skills:
- api-design-principles
- stripe-integration
- auth-implementation-patterns
- terraform-module-library
- prometheus-configuration

Deliverables:
- Backend API (FastAPI/Django/Express)
- Frontend (React/Next.js)
- PostgreSQL database
- Authentication (JWT + refresh tokens)
- Payment processing (Stripe)
- Admin dashboard
- Comprehensive tests
- Docker deployment
- CI/CD pipeline
- Monitoring (Prometheus + Grafana)
- Complete documentation
```

### 4. Kubernetes Infrastructure

```
Build this repository into production-grade Kubernetes infrastructure with GitOps.

Use agents:
- kubernetes-architect (Opus) - K8s design
- terraform-specialist (Sonnet) - IaC
- deployment-engineer (Sonnet) - CI/CD

Activate all K8s skills:
- k8s-manifest-generator
- helm-chart-scaffolding
- gitops-workflow
- k8s-security-policies

Build:
1. Kubernetes manifests (Deployments, Services, ConfigMaps, Secrets)
2. Helm charts for all services
3. ArgoCD GitOps setup
4. Network policies and RBAC
5. Ingress controllers (Nginx/Traefik)
6. /security-scanning:security-hardening
7. /observability-monitoring:monitor-setup (Prometheus + Grafana)
8. /deployment-validation:config-validate
9. /code-documentation:doc-generate

Deliverables:
- Complete K8s manifests
- Production-ready Helm charts
- GitOps workflow (ArgoCD)
- Security policies (RBAC + NetworkPolicy)
- Monitoring stack
- Complete deployment documentation
```

### 5. LLM/AI Application

```
Build this repository into a production-ready LLM application with LangChain.

Use agents:
- ai-engineer (Sonnet) - LLM architecture
- prompt-engineer (Sonnet) - Prompt optimization
- backend-architect (Opus) - API design

Activate skills:
- langchain-architecture
- prompt-engineering-patterns
- rag-implementation
- llm-evaluation

Build:
1. /llm-application-dev:langchain-agent "implement intelligent assistant"
2. RAG system with vector database (Pinecone/Weaviate)
3. Prompt templates and chain of thought
4. LLM evaluation framework
5. FastAPI backend with streaming
6. /unit-testing:test-generate
7. /security-scanning:security-hardening
8. /observability-monitoring:monitor-setup
9. /code-documentation:doc-generate

Deliverables:
- LangChain application
- Vector database integration
- Prompt template library
- LLM evaluation suite
- Streaming API endpoints
- Comprehensive tests
- Performance monitoring
- Complete documentation
```

### 6. CLI Tool / Developer Tool

```
Build this repository into a production-ready CLI tool.

Use agents:
- golang-pro (Sonnet) for Go CLI
  OR python-pro (Sonnet) for Python CLI
  OR rust-pro (Sonnet) for Rust CLI

Activate skills:
- bash-defensive-patterns
- bats-testing-patterns
- shellcheck-configuration

Build:
1. CLI framework (Cobra/Click/Clap)
2. Command structure and subcommands
3. Configuration management (YAML/TOML)
4. Output formatting (tables, JSON, colored)
5. /unit-testing:test-generate
6. Shell completion scripts
7. Man pages / help documentation
8. GitHub release automation
9. /code-documentation:doc-generate

Deliverables:
- Complete CLI tool
- Installation scripts
- Shell completions (bash/zsh/fish)
- Comprehensive tests
- Man pages
- Homebrew formula / apt package
- Release automation
- Complete documentation
```

### 7. Mobile Application (React Native)

```
Build this repository into a production-ready cross-platform mobile app.

Use agents:
- mobile-developer (Sonnet) - React Native
- ios-developer (Sonnet) - Native iOS
- ui-ux-designer (Sonnet) - Mobile UI

Activate skills:
- modern-javascript-patterns
- typescript-advanced-types

Build:
1. React Native project setup (Expo or bare)
2. Navigation (React Navigation)
3. State management (Redux/Zustand)
4. Native modules (camera, location, etc.)
5. Push notifications
6. /unit-testing:test-generate (Jest + Detox)
7. /frontend-mobile-security:xss-scan
8. App store assets (icons, screenshots)
9. /code-documentation:doc-generate

Deliverables:
- React Native app
- iOS + Android builds
- Navigation flow
- State management
- Native integrations
- E2E tests (Detox)
- App store ready assets
- Complete documentation
```

### 8. Data Pipeline / ETL

```
Build this repository into a production-ready data pipeline.

Use agents:
- data-engineer (Sonnet) - Pipeline architecture
- backend-architect (Opus) - System design
- database-architect (Opus) - Data modeling

Activate skills:
- sql-optimization-patterns

Build:
1. /data-engineering:data-pipeline "ETL pipeline design"
2. Data ingestion layer (APIs, files, streams)
3. Transformation logic (Pandas/Spark)
4. Data validation and quality checks
5. Database/warehouse loading (PostgreSQL/Snowflake)
6. Airflow/Prefect orchestration
7. /unit-testing:test-generate
8. /observability-monitoring:monitor-setup
9. /code-documentation:doc-generate

Deliverables:
- Complete ETL pipeline
- Data validation framework
- Orchestration DAGs
- Error handling and retries
- Data quality monitoring
- Comprehensive tests
- Complete documentation
```

### 9. Machine Learning Project

```
Build this repository into a production-ready ML pipeline.

Use agents:
- ml-engineer (Sonnet) - ML pipelines
- data-scientist (Sonnet) - Model development
- mlops-engineer (Sonnet) - MLOps automation

Activate skills:
- ml-pipeline-workflow

Build:
1. /machine-learning-ops:ml-pipeline "ML training and deployment"
2. Data preprocessing pipeline
3. Model training framework
4. Experiment tracking (MLflow/Weights & Biases)
5. Model versioning and registry
6. Inference API (FastAPI)
7. Model monitoring and drift detection
8. /unit-testing:test-generate
9. /code-documentation:doc-generate

Deliverables:
- ML training pipeline
- Experiment tracking
- Model serving API
- Model monitoring
- Comprehensive tests
- MLflow/Kubeflow setup
- Complete documentation
```

### 10. Blockchain / Web3 Application

```
Build this repository into a production-ready Web3 application.

Use agents:
- blockchain-developer (Sonnet) - Smart contracts
- frontend-developer (Sonnet) - Web3 UI
- backend-architect (Opus) - Architecture

Activate skills:
- solidity-security
- defi-protocol-templates
- nft-standards
- web3-testing

Build:
1. Smart contract development (Solidity)
2. Contract testing (Hardhat/Foundry)
3. Web3 frontend (ethers.js/web3.js)
4. Wallet integration (MetaMask/WalletConnect)
5. /security-scanning:security-hardening (audit smart contracts)
6. Deployment scripts (mainnet/testnet)
7. Subgraph for indexing (The Graph)
8. /code-documentation:doc-generate

Deliverables:
- Audited smart contracts
- Web3 frontend application
- Comprehensive tests
- Deployment automation
- Subgraph for data indexing
- Security audit report
- Complete documentation
```

---

## Minimal One-Liner Prompts

For quick starts:

**Universal:**
```
Build this repository into a complete, production-ready project using all available agents.
```

**Python:**
```
/python-development:python-scaffold fastapi-microservice then build complete production app
```

**JavaScript/TypeScript:**
```
/javascript-typescript:typescript-scaffold {name} then build complete production app
```

**Full-Stack:**
```
/full-stack-orchestration:full-stack-feature "complete production application"
```

**Infrastructure:**
```
Use cloud-architect and kubernetes-architect to build production infrastructure
```

---

## Progressive Build Pattern

For iterative development:

```
Build this repository progressively:

Week 1 - Foundation:
- Architecture design
- Project scaffolding
- Core models/schemas
- Basic tests

Week 2 - Core Features:
- Primary functionality
- Business logic
- API endpoints
- Feature tests

Week 3 - Quality & Security:
- /comprehensive-review:full-review
- /security-scanning:security-hardening
- Performance optimization
- Documentation

Week 4 - Production Ready:
- /cicd-automation:workflow-automate
- /observability-monitoring:monitor-setup
- Deployment automation
- Final documentation

Execute Week 1 foundation phase now.
```

---

## Real-Time Applications (This Repository)

**Customized prompt for this specific repository:**

```
Build claude-code-realtime-apps into a complete production-ready real-time platform.

Current state: Foundation complete (70/100)
✅ WebSocket server, Redis scaling, offline-first, Docker
🔴 Missing: Tests (0%), security gaps, performance issues, documentation gaps

Execute missing phases:

Phase 2 - Testing:
/unit-testing:test-generate
Target: 80% coverage (140+ test cases)

Phase 3 - Security:
/security-scanning:security-hardening --level comprehensive
Fix: Rate limits, emoji validation, encryption config

Phase 4 - Documentation:
/documentation-generation:doc-generate
Create: Mental models, ADRs, API reference, progressive examples

Phase 5 - Performance:
/application-performance:performance-optimization
Fix: N+1 queries, connection pooling, magic numbers

Phase 6 - Observability:
/observability-monitoring:monitor-setup
Add: Prometheus metrics, OpenTelemetry, SLO definitions

Goal: 70/100 → 92/100 (A grade)
```

---

## Repository-Specific Naming

Replace placeholders:
- `{repo_name}` → Actual repository name
- `{project_type}` → Project type (fastapi-microservice, react-app, etc.)
- `{feature}` → Specific feature name

---

## Next Steps After Using Prompts

After Claude builds the repository:

1. **Review the plan** - Ensure it aligns with your vision
2. **Verify each phase** - Check implementation quality
3. **Run tests** - `npm test` / `pytest` / etc.
4. **Security scan** - `/security-scanning:security-hardening`
5. **Deploy** - Follow deployment documentation
6. **Monitor** - Setup observability from day one

---

## Quick Reference: Agent Selection

| Repository Type | Primary Agents | Key Skills |
|----------------|----------------|------------|
| Python API | python-pro, fastapi-pro | async-python-patterns, python-testing |
| React App | frontend-developer, typescript-pro | typescript-advanced-types, modern-javascript |
| Full-Stack SaaS | 7+ agents via orchestration | api-design, stripe-integration, auth-patterns |
| Kubernetes | kubernetes-architect, terraform-specialist | k8s-manifest-generator, gitops-workflow |
| LLM App | ai-engineer, prompt-engineer | langchain-architecture, rag-implementation |
| CLI Tool | golang-pro/python-pro/rust-pro | bash-defensive-patterns, shellcheck |
| Mobile App | mobile-developer, ios-developer | modern-javascript-patterns |
| Data Pipeline | data-engineer, database-architect | sql-optimization-patterns |
| ML Project | ml-engineer, mlops-engineer | ml-pipeline-workflow |
| Web3 App | blockchain-developer | solidity-security, web3-testing |

---

**Last Updated:** 2025-11-20
**Version:** 1.0
**Compatible With:** wshobson/agents v1.0 (85 agents, 63 plugins, 47 skills)
