import { Construct } from "constructs";
import { TerraformStack } from "cdktf";
import { AzurermProvider } from "@cdktf/provider-azurerm/lib/provider";
import { ResourceGroup } from "@cdktf/provider-azurerm/lib/resource-group";
import { StorageAccount } from "@cdktf/provider-azurerm/lib/storage-account";
import { CosmosdbAccount } from "@cdktf/provider-azurerm/lib/cosmosdb-account";
import { CosmosdbSqlDatabase } from "@cdktf/provider-azurerm/lib/cosmosdb-sql-database";
import { CosmosdbSqlContainer } from "@cdktf/provider-azurerm/lib/cosmosdb-sql-container";
import { ServicePlan } from "@cdktf/provider-azurerm/lib/service-plan";
import { FunctionApp } from "@cdktf/provider-azurerm/lib/function-app";
import { ApplicationInsights } from "@cdktf/provider-azurerm/lib/application-insights"; // ✅ Added for Monitoring
import { TerraformOutput } from "cdktf";

export class StorageStack extends TerraformStack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        new AzurermProvider(this, "AzureRm", {
            subscriptionId: process.env.AZURE_SUBSCRIPTION_ID!,
            features: {} as any,
        });
        const resourceGroup = new ResourceGroup(this, "ResourceGroup", {
            name: "cosmos-storage-rg",
            location: "Germany West Central",
            lifecycle: { preventDestroy: false },
        });

        // ✅ Minimal Storage Account (Required for FunctionApp)
        const storageAccount = new StorageAccount(this, "StorageAccount", {
            name: `pmfuncstorage${Math.floor(Math.random() * 10000)}`, // ✅ Ensures uniqueness
            resourceGroupName: resourceGroup.name,
            location: resourceGroup.location,
            accountTier: "Standard",
            accountReplicationType: "LRS",
            infrastructureEncryptionEnabled: true,
            minTlsVersion: "TLS1_2",
        });

        // ✅ Add CosmosDB Account
        const cosmosdbAccount = new CosmosdbAccount(this, "CosmosDBAccount", {
            name: "pm-cosmosdb",
            resourceGroupName: resourceGroup.name,
            location: resourceGroup.location,
            offerType: "Standard",
            kind: "GlobalDocumentDB",
            geoLocation: [{ location: resourceGroup.location, failoverPriority: 0 }],
            consistencyPolicy: { consistencyLevel: "Session" },
        });

        // ✅ Create CosmosDB Database
        const cosmosdbDatabase = new CosmosdbSqlDatabase(this, "CosmosDBDatabase", {
            name: "pm-database",
            resourceGroupName: resourceGroup.name,
            accountName: cosmosdbAccount.name,
        });

        // ✅ Create CosmosDB Container
        const cosmosdbContainer = new CosmosdbSqlContainer(this, "CosmosDBContainer", {
            name: "pm-container",
            resourceGroupName: resourceGroup.name,
            accountName: cosmosdbAccount.name,
            databaseName: cosmosdbDatabase.name,
            partitionKeyPaths: ["/partitionKey"],
            partitionKeyVersion: 2,
        });

        // ✅ Define a Consumption Plan (Serverless Plan)
        const consumptionPlan = new ServicePlan(this, "ServicePlan", {
            name: "cosmosdb-consumption-plan",
            resourceGroupName: resourceGroup.name,
            location: resourceGroup.location,
            osType: "Linux",
            skuName: "Y1", // ✅ Consumption Plan (Serverless)
        });

        // ✅ Add Application Insights for Monitoring
        const appInsights = new ApplicationInsights(this, "AppInsights", {
            name: "cosmosdb-function-insights",
            resourceGroupName: resourceGroup.name,
            location: resourceGroup.location,
            applicationType: "web",
        });

        //Deploy Function App (Linked to Consumption Plan)
        new FunctionApp(this, "FunctionApp", {
            name: `cosmosdb-function-${Math.floor(Math.random() * 10000)}`,
            resourceGroupName: resourceGroup.name,
            location: resourceGroup.location,
            storageAccountName: storageAccount.name,
            storageAccountAccessKey: storageAccount.primaryAccessKey,
            appServicePlanId: consumptionPlan.id, // ✅ Required to assign Consumption Plan
            siteConfig: {
                linuxFxVersion: "DOTNET-ISOLATED|8.0",
                alwaysOn: false, // ✅ Ensure serverless mode
            },
            appSettings: {
                COSMOSDB_CONNECTION_STRING: cosmosdbAccount.primaryKey, // ✅ Function can connect to CosmosDB
                COSMOSDB_DATABASE_NAME: cosmosdbDatabase.name,
                COSMOSDB_CONTAINER_NAME: cosmosdbContainer.name,
                AzureWebJobsStorage: storageAccount.primaryConnectionString,
                FUNCTIONS_WORKER_RUNTIME: "dotnet-isolated",
                FUNCTIONS_EXTENSION_VERSION: "~4",
                APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.connectionString, // ✅ Logs & monitoring
            },
        });

        // ✅ Outputs for debugging
        new TerraformOutput(this, "cosmosDbConnectionString", {
            value: cosmosdbAccount.primaryKey,
            sensitive: true, // ✅ Mark sensitive to avoid Terraform errors
        });

        new TerraformOutput(this, "applicationInsightsKey", {
            value: appInsights.connectionString,
            sensitive: true, // ✅ Logs & monitoring output
        });

        new TerraformOutput(this, "storageAccountName", {
            value: storageAccount.name,
        });
    }
}
