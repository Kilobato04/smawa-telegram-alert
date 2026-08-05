# Guía de Despliegue

## 1. Despliegue del Frontend (Lienzo)
El frontend se despliega automáticamente en Netlify.
1. Conecta este repositorio a Netlify.
2. Configura el directorio de publicación como `public/`.
3. Anota la URL generada (ej. `https://dashboard-smawa.netlify.app`).

## 2. Despliegue de la Lambda
La Lambda se despliega usando AWS SAM o empaquetado manual.

1. Abre CloudShell en AWS.
2. Navega a `lambda/generate-alert/`.
3. Ejecuta el script de despliegue:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
