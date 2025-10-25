# LiteDesk Multi-Instance Deployment Guide

This guide will walk you through deploying the LiteDesk multi-instance architecture to production.

## 📋 Prerequisites

Before you begin, ensure you have:

1. **AWS Account** with appropriate permissions
2. **Docker** installed locally
3. **kubectl** installed and configured
4. **Helm** v3+ installed
5. **AWS CLI** configured with your credentials
6. **Domain name** (e.g., `litedesk.com`)

---

## Phase 1: AWS Infrastructure Setup

### Step 1.1: Create EKS Cluster

```bash
# Install eksctl if you haven't already
brew install eksctl  # macOS
# or download from https://eksctl.io/

# Create EKS cluster
eksctl create cluster \
  --name litedesk-production \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 5 \
  --managed

# This will take 15-20 minutes
# Once complete, kubectl will be automatically configured
```

### Step 1.2: Install NGINX Ingress Controller

```bash
# Add the ingress-nginx repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install NGINX Ingress Controller
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer

# Wait for external IP to be assigned
kubectl get svc -n ingress-nginx -w
```

**Important:** Note the EXTERNAL-IP (LoadBalancer DNS). You'll need this for DNS configuration.

### Step 1.3: Install Cert-Manager (for SSL)

```bash
# Add the cert-manager repository
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.crds.yaml

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.13.0

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@litedesk.com  # Change this to your email
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### Step 1.4: Configure Route 53

1. **Create Hosted Zone** (if you haven't already):
   ```bash
   aws route53 create-hosted-zone \
     --name litedesk.com \
     --caller-reference $(date +%s)
   ```

2. **Note the Hosted Zone ID** from the output

3. **Create wildcard DNS record**:
   ```bash
   # Get the LoadBalancer DNS from ingress-nginx
   LOADBALANCER_DNS=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
   
   # Note: You'll need to create a CNAME record for *.litedesk.com pointing to the LoadBalancer
   # This can be done via AWS Console or AWS CLI
   ```

4. **Update your domain's nameservers** to point to Route 53 nameservers

---

## Phase 2: Deploy Master Control Plane

### Step 2.1: Build and Push Docker Images

```bash
# Navigate to project root
cd /path/to/LiteDesk

# Build backend image
docker build -f Dockerfile.backend -t your-registry/litedesk-backend:latest .

# Build frontend image
docker build -f Dockerfile.frontend -t your-registry/litedesk-frontend:latest .

# Push to registry (Docker Hub, ECR, etc.)
docker push your-registry/litedesk-backend:latest
docker push your-registry/litedesk-frontend:latest
```

**For AWS ECR:**
```bash
# Create ECR repositories
aws ecr create-repository --repository-name litedesk-backend
aws ecr create-repository --repository-name litedesk-frontend

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Tag images
docker tag litedesk-backend:latest YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/litedesk-backend:latest
docker tag litedesk-frontend:latest YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/litedesk-frontend:latest

# Push
docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/litedesk-backend:latest
docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/litedesk-frontend:latest
```

### Step 2.2: Deploy Master Control Plane with Helm

```bash
# Create namespace for master control plane
kubectl create namespace litedesk-master

# Create secrets
kubectl create secret generic litedesk-master-secrets \
  --from-literal=MONGO_URI='your_mongodb_connection_string' \
  --from-literal=JWT_SECRET='your_jwt_secret' \
  --from-literal=REFRESH_TOKEN_SECRET='your_refresh_secret' \
  --from-literal=AWS_ACCESS_KEY_ID='your_aws_key' \
  --from-literal=AWS_SECRET_ACCESS_KEY='your_aws_secret' \
  --from-literal=ROUTE53_HOSTED_ZONE_ID='your_hosted_zone_id' \
  --from-literal=MASTER_API_KEY='your_master_api_key' \
  -n litedesk-master

# Update helm/litedesk/values.yaml with your configuration
# Then deploy
helm install litedesk-master ./helm/litedesk \
  --namespace litedesk-master \
  --set image.backend.repository=YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/litedesk-backend \
  --set image.frontend.repository=YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/litedesk-frontend \
  --set ingress.hosts[0].host=app.litedesk.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.tls[0].secretName=litedesk-master-tls \
  --set ingress.tls[0].hosts[0]=app.litedesk.com
```

### Step 2.3: Verify Deployment

```bash
# Check pods
kubectl get pods -n litedesk-master

# Check ingress
kubectl get ingress -n litedesk-master

# Test health endpoint
curl https://app.litedesk.com/health
```

---

## Phase 3: Install Dependencies

### Step 3.1: Install Node Packages

```bash
cd server
npm install @kubernetes/client-node aws-sdk bull redis yaml axios
```

### Step 3.2: Set Environment Variables

Create `server/.env` from `server/.env.example` and update all values:

```bash
cp server/.env.example server/.env
nano server/.env  # or use your preferred editor
```

**Critical Environment Variables:**
- `MONGO_URI`: MongoDB connection for master database
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: For Route 53 and other AWS services
- `ROUTE53_HOSTED_ZONE_ID`: Your Route 53 hosted zone
- `BASE_DOMAIN`: Your base domain (e.g., `litedesk.com`)
- `KUBECONFIG_PATH`: Path to kubeconfig (for local testing, use `~/.kube/config`)
- `INGRESS_LOADBALANCER_DNS`: LoadBalancer DNS from Step 1.2
- `MONGODB_ADMIN_URI`: Admin connection string for creating new DBs

---

## Phase 4: Database Setup

### Step 4.1: MongoDB Atlas (Recommended) or Self-Hosted

**Option A: MongoDB Atlas**
1. Create a cluster at https://cloud.mongodb.com
2. Create database user
3. Whitelist IP addresses (or 0.0.0.0/0 for all)
4. Get connection string and update `MONGO_URI` in `.env`

**Option B: Self-Hosted MongoDB in Kubernetes**
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install mongodb bitnami/mongodb \
  --namespace litedesk-master \
  --set auth.rootPassword=YOUR_ROOT_PASSWORD \
  --set auth.database=litedesk_master
```

---

## Phase 5: Testing

### Step 5.1: Local Testing with Docker Compose

```bash
# From project root
docker-compose up -d

# Access:
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
# MongoDB: localhost:27017
```

### Step 5.2: Test Instance Provisioning

1. Register a new account (this creates the first organization)
2. Submit a demo request via the landing page
3. Log in as the owner/admin
4. Navigate to "Demo Requests"
5. Click "Convert to Organization" on a demo request
6. Navigate to "Instances" to monitor provisioning progress

---

## Phase 6: CI/CD Setup (Optional)

### Step 6.1: GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        run: |
          aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com
      
      - name: Build and push backend
        run: |
          docker build -f Dockerfile.backend -t ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com/litedesk-backend:${{ github.sha }} .
          docker push ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com/litedesk-backend:${{ github.sha }}
      
      - name: Build and push frontend
        run: |
          docker build -f Dockerfile.frontend -t ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com/litedesk-frontend:${{ github.sha }} .
          docker push ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com/litedesk-frontend:${{ github.sha }}
      
      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --region us-east-1 --name litedesk-production
      
      - name: Deploy with Helm
        run: |
          helm upgrade litedesk-master ./helm/litedesk \
            --namespace litedesk-master \
            --set image.backend.tag=${{ github.sha }} \
            --set image.frontend.tag=${{ github.sha }} \
            --reuse-values
```

---

## Phase 7: Monitoring & Maintenance

### Step 7.1: Monitor Health

```bash
# Check master control plane health
curl https://app.litedesk.com/health

# Check system status
curl https://app.litedesk.com/health/status

# View all instance health
# Log in to admin dashboard → Instances
```

### Step 7.2: View Logs

```bash
# Master control plane logs
kubectl logs -n litedesk-master -l app=litedesk-backend -f

# Specific customer instance logs
kubectl logs -n litedesk-customer-acme -l app=litedesk-backend -f
```

### Step 7.3: Scaling

```bash
# Scale master control plane
kubectl scale deployment litedesk-backend --replicas=3 -n litedesk-master

# Scale a customer instance
kubectl scale deployment litedesk-acme-corp --replicas=2 -n litedesk-acme-corp
```

---

## Troubleshooting

### Issue: Pods not starting
```bash
# Check pod status
kubectl describe pod <pod-name> -n <namespace>

# Check logs
kubectl logs <pod-name> -n <namespace>
```

### Issue: DNS not resolving
```bash
# Verify Route 53 records
aws route53 list-resource-record-sets --hosted-zone-id YOUR_ZONE_ID

# Test DNS resolution
nslookup customer.litedesk.com
```

### Issue: SSL certificate not issued
```bash
# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager -f

# Check certificate status
kubectl describe certificate -n <namespace>
```

---

## Security Checklist

- [ ] Change all default passwords and secrets
- [ ] Enable network policies in Kubernetes
- [ ] Set up AWS IAM roles with least privilege
- [ ] Enable MongoDB authentication and encryption
- [ ] Configure rate limiting on ingress
- [ ] Set up AWS CloudWatch alerts
- [ ] Enable audit logging
- [ ] Regular security updates and patches
- [ ] Backup strategy in place
- [ ] Disaster recovery plan documented

---

## Cost Optimization

1. **Use spot instances** for non-critical workloads
2. **Enable autoscaling** for EKS node groups
3. **Use S3 lifecycle policies** for old data
4. **Monitor unused resources** with AWS Cost Explorer
5. **Right-size instances** based on actual usage

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/litedesk/issues
- Email: support@litedesk.com
- Documentation: https://docs.litedesk.com

---

**🎉 Congratulations!** You've successfully deployed the LiteDesk multi-instance architecture!

