# 🚀 LiteDesk - Multi-Instance CRM Platform

> **Enterprise-grade, white-label CRM with automated multi-instance architecture**

LiteDesk is a modern CRM platform built on a unique multi-instance architecture where each customer gets their own isolated application instance with dedicated database, subdomain, and independent scaling.

---

## ✨ Features

### 🏢 Multi-Instance Architecture
- **Complete Isolation:** Each customer gets a dedicated application instance
- **Dedicated Database:** Separate MongoDB database per customer
- **Custom Subdomains:** Automatic subdomain provisioning (e.g., `acme.litedesk.com`)
- **Independent Scaling:** Scale each customer instance independently
- **White-Label Ready:** Full customization per instance

### 🎯 Core CRM Features
- **Contact Management:** Organize and manage customer contacts
- **Deal Pipeline:** Visual sales pipeline with drag-and-drop
- **Task Management:** Track activities and follow-ups
- **Role-Based Access Control:** 5-tier permission system (Owner, Admin, Manager, User, Viewer)
- **Multi-Tenancy:** Organization-based data isolation
- **Subscription Management:** Built-in trial and subscription system

### 🔧 Admin Features
- **Demo Request System:** Capture and qualify leads
- **Instance Provisioning:** One-click conversion to full instance
- **Instance Management Dashboard:** Monitor all customer instances
- **Health Monitoring:** Automated health checks every 5 minutes
- **Metrics Collection:** Usage tracking and analytics
- **Subscription Management:** Manage tiers and billing

### 🛡️ Security & Compliance
- **JWT Authentication:** Secure token-based auth
- **Database-Level Isolation:** Complete data separation
- **Encrypted Connections:** SSL/TLS everywhere
- **RBAC:** Granular permission control
- **Audit Logging:** Track all user actions

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Master Control Plane                        │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Frontend  │  │   Backend    │  │  Master MongoDB  │    │
│  │  (Vue.js)  │  │  (Node.js)   │  │                  │    │
│  └────────────┘  └──────────────┘  └──────────────────┘    │
│         │                │                      │            │
│         └────────────────┴──────────────────────┘            │
│                          │                                   │
│         ┌────────────────────────────────┐                  │
│         │   Instance Provisioner         │                  │
│         │   - Kubernetes Manager         │                  │
│         │   - Database Manager           │                  │
│         │   - DNS Manager                │                  │
│         └────────────────────────────────┘                  │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │        Kubernetes Cluster            │
        │                                      │
        │  ┌─────────────────────────────┐    │
        │  │  Customer Instance 1        │    │
        │  │  - Frontend (Nginx)         │    │
        │  │  - Backend (Node.js)        │    │
        │  │  - MongoDB                  │    │
        │  │  - acme.litedesk.com        │    │
        │  └─────────────────────────────┘    │
        │                                      │
        │  ┌─────────────────────────────┐    │
        │  │  Customer Instance 2        │    │
        │  │  - Frontend (Nginx)         │    │
        │  │  - Backend (Node.js)        │    │
        │  │  - MongoDB                  │    │
        │  │  - corp.litedesk.com        │    │
        │  └─────────────────────────────┘    │
        └──────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 7.0+
- Docker & Docker Compose (for local development)
- AWS Account (for production deployment)
- kubectl & Helm 3+ (for Kubernetes deployment)

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/litedesk.git
cd litedesk

# Start with Docker Compose
docker-compose up -d

# Access the application
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
# MongoDB: localhost:27017
```

### Manual Setup

```bash
# Install backend dependencies
cd server
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Start backend
npm start

# In a new terminal, install frontend dependencies
cd ../client
npm install

# Start frontend
npm run dev
```

---

## 📚 Documentation

- **[Technical Specification](TECHNICAL_SPEC.md)** - Complete technical details
- **[Multi-Instance Implementation Guide](MULTI_INSTANCE_IMPLEMENTATION.md)** - Implementation steps
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment
- **[Build Summary](BUILD_SUMMARY.md)** - Development progress

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB 7.0
- **Authentication:** JWT + bcrypt
- **Cloud SDK:** AWS SDK (S3, SES, Route 53)
- **Kubernetes:** @kubernetes/client-node
- **Queue:** Bull + Redis (optional)

### Frontend
- **Framework:** Vue.js 3 (Composition API)
- **State Management:** Pinia
- **Routing:** Vue Router
- **Styling:** Tailwind CSS
- **UI Components:** Headless UI

### Infrastructure
- **Containerization:** Docker
- **Orchestration:** Kubernetes (AWS EKS)
- **Package Manager:** Helm 3
- **Web Server:** Nginx
- **SSL:** cert-manager + Let's Encrypt
- **DNS:** AWS Route 53
- **Storage:** AWS S3
- **Email:** AWS SES

### CI/CD
- **GitHub Actions** - Automated builds and deployments
- **AWS ECR** - Docker image registry

---

## 🚢 Deployment

### Production Deployment to AWS

Follow the comprehensive [Deployment Guide](DEPLOYMENT_GUIDE.md) for step-by-step instructions.

**Quick Overview:**
1. Create AWS EKS cluster
2. Install ingress-nginx and cert-manager
3. Configure Route 53 DNS
4. Build and push Docker images
5. Deploy with Helm
6. Configure environment variables
7. Test instance provisioning

### Environment Variables

Copy `server/.env.example` to `server/.env` and configure:

```bash
# Server
PORT=3000
NODE_ENV=production

# Database
MONGO_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret

# AWS
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
ROUTE53_HOSTED_ZONE_ID=your_hosted_zone_id
BASE_DOMAIN=litedesk.com

# Kubernetes
KUBECONFIG_PATH=/path/to/kubeconfig
INGRESS_LOADBALANCER_DNS=your-loadbalancer-dns

# Monitoring (optional)
ENABLE_HEALTH_CHECKER=true
ENABLE_METRICS_COLLECTOR=true
```

---

## 📊 Project Structure

```
litedesk/
├── server/                          # Backend Node.js application
│   ├── models/                      # Mongoose models
│   │   ├── User.js
│   │   ├── Organization.js
│   │   ├── Contact.js
│   │   ├── DemoRequest.js
│   │   └── InstanceRegistry.js      # Multi-instance registry
│   ├── controllers/                 # Request handlers
│   ├── routes/                      # API routes
│   ├── middleware/                  # Auth, RBAC, etc.
│   ├── services/                    # Business logic
│   │   ├── provisioning/            # Instance provisioning
│   │   │   ├── instanceProvisioner.js
│   │   │   ├── managers/            # K8s, DB, DNS managers
│   │   │   └── utils/
│   │   └── monitoring/              # Health checks, metrics
│   └── server.js                    # Entry point
├── client/                          # Frontend Vue.js application
│   ├── src/
│   │   ├── components/              # Reusable components
│   │   ├── views/                   # Page components
│   │   │   ├── Dashboard.vue
│   │   │   ├── DemoRequests.vue
│   │   │   └── InstanceManagement.vue
│   │   ├── stores/                  # Pinia stores
│   │   ├── router/                  # Vue Router
│   │   └── utils/                   # Utilities
│   └── vite.config.js
├── helm/                            # Kubernetes Helm charts
│   └── litedesk/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/               # K8s resource templates
├── .github/
│   └── workflows/                   # GitHub Actions CI/CD
│       ├── deploy-master.yml
│       ├── test.yml
│       ├── docker-publish.yml
│       └── monitoring.yml
├── Dockerfile.backend               # Backend container
├── Dockerfile.frontend              # Frontend container
├── docker-compose.yml               # Local development
├── nginx.conf                       # Nginx configuration
└── README.md                        # This file
```

---

## 🧪 Testing

```bash
# Run backend tests
cd server
npm test

# Run frontend tests
cd client
npm test

# Test Docker builds
docker-compose up --build

# Test Kubernetes deployment (local)
helm install litedesk-test ./helm/litedesk --dry-run --debug
```

---

## 📈 Monitoring

### Health Checks
- **Master Control Plane:** `https://your-domain.com/health`
- **System Status:** `https://your-domain.com/health/status`
- **Automated checks:** Every 5 minutes

### Metrics
- **Instance Dashboard:** View in admin UI `/instances`
- **Aggregated Metrics:** API endpoint `/api/metrics/aggregated`
- **Collection frequency:** Every 15 minutes

### Logs
```bash
# Master control plane logs
kubectl logs -n litedesk-master -l app=litedesk-backend -f

# Customer instance logs
kubectl logs -n litedesk-{customer-slug} -l app=litedesk-backend -f
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- Code follows existing style guidelines
- All tests pass
- Documentation is updated
- No linter errors

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

- **Documentation:** [docs.litedesk.com](https://docs.litedesk.com)
- **Issues:** [GitHub Issues](https://github.com/yourusername/litedesk/issues)
- **Email:** support@litedesk.com
- **Community:** [Discord](https://discord.gg/litedesk)

---

## 🎯 Roadmap

### ✅ Completed
- [x] Multi-tenant CRM with RBAC
- [x] Demo request system
- [x] Multi-instance architecture
- [x] Automated provisioning
- [x] Instance management dashboard
- [x] Health monitoring
- [x] Metrics collection
- [x] Docker containerization
- [x] Kubernetes Helm charts
- [x] CI/CD pipelines

### 🚧 In Progress
- [ ] Stripe payment integration
- [ ] Email automation (trial reminders, etc.)
- [ ] Custom domain support

### 📅 Planned
- [ ] Advanced analytics dashboard
- [ ] API rate limiting per instance
- [ ] Automated backups
- [ ] Instance cloning/templates
- [ ] Multi-region support
- [ ] Mobile app
- [ ] Webhooks
- [ ] Integration marketplace

---

## 🙏 Acknowledgments

- Built with ❤️ using modern web technologies
- Inspired by enterprise SaaS best practices
- Community-driven and open-source

---

## 📞 Contact

**Project Maintainer:** Your Name
- Website: [litedesk.com](https://litedesk.com)
- Email: hello@litedesk.com
- Twitter: [@litedesk](https://twitter.com/litedesk)

---

**⭐ Star this repo if you find it helpful!**

**Made with 💙 by developers, for developers**
