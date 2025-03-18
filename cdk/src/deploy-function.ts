const { execSync } = require("child_process");
const path = require("path");

const functionAppName = "blob-storage-function"; // Ensure this matches the CDKTF definition
const functionDir = path.resolve(__dirname, "../../function"); // Resolve absolute path

console.log("📦 Packaging Azure Function...");
execSync(`dotnet publish ${functionDir} --configuration Release --output ${functionDir}/publish`, { stdio: "inherit" });

console.log("🚀 Deploying Function to Azure...");
execSync(`az functionapp deployment source config-zip --name ${functionAppName} --resource-group blob-storage-rg --src ${functionDir}/publish`, { stdio: "inherit" });

console.log("✅ Deployment complete!");
