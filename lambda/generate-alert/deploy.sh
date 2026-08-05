#!/bin/bash
echo "Empaquetando Lambda..."
npm install
zip -r smawa-lambda.zip . -x "*.git*" "deploy.sh" "test-local.js"
echo "Subiendo a AWS Lambda..."
# Reemplaza 'SmawaAlertFunction' por el nombre real de tu función en AWS
aws lambda update-function-code --function-name SmawaAlertFunction --zip-file fileb://smawa-lambda.zip
echo "Despliegue completado."
