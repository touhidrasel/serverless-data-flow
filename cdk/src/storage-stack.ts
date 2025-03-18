import { Construct } from "constructs";
import { TerraformStack } from "cdktf";
import { AzurermProvider } from "@cdktf/provider-azurerm/lib/provider";
import { StorageAccount } from "@cdktf/provider-azurerm/lib/storage-account";
import { StorageContainer } from "@cdktf/provider-azurerm/lib/storage-container";
import { ResourceGroup } from "@cdktf/provider-azurerm/lib/resource-group";
import { ServicePlan } from "@cdktf/provider-azurerm/lib/service-plan";
import { FunctionApp } from "@cdktf/provider-azurerm/lib/function-app";
import { TerraformOutput } from "cdktf";

export class StorageStack extends TerraformStack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // Azure Provider
        new AzurermProvider(this, "AzureRm", {
            subscriptionId: process.env.AZURE_SUBSCRIPTION_ID!,
            features: {} as any,
        });

        // Resource Group
        const resourceGroup = new ResourceGroup(this, "ResourceGroup", {
            name: "blob-storage-rg",
            location: "Germany West Central",
        });

        // Storage Account
        const storageAccount = new StorageAccount(this, "StorageAccount", {
            name: "pmblobtempstorage",
            resourceGroupName: resourceGroup.name,
            location: resourceGroup.location,
            accountTier: "Standard",
            accountReplicationType: "LRS",
        });

        // Storage Container
        const storageContainer = new StorageContainer(this, "StorageContainer", {
            name: "blobtempcontainer",
            storageAccountName: storageAccount.name,
            containerAccessType: "private",
        });

        // App Service Plan (Consumption Plan for Functions)
        const appServicePlan = new ServicePlan(this, "ServicePlan", {
            name: "blob-storage-plan",
            resourceGroupName: resourceGroup.name,
            location: resourceGroup.location,
            osType: "Linux",
            skuName: "Y1", // Consumption plan
        });

        new FunctionApp(this, "FunctionApp", {
            name: "blob-storage-function",
            resourceGroupName: resourceGroup.name,
            location: resourceGroup.location,
            appServicePlanId: appServicePlan.id,
            storageAccountName: storageAccount.name,
            storageAccountAccessKey: storageAccount.primaryAccessKey,

            appSettings: {
                AZURE_SUBSCRIPTION_ID: process.env.AZURE_SUBSCRIPTION_ID!,
                AZURE_STORAGE_ACCOUNT: storageAccount.name,
                AZURE_STORAGE_CONTAINER: storageContainer.name,
                AzureWebJobsStorage: storageAccount.primaryConnectionString,
                FUNCTIONS_EXTENSION_VERSION: "~4",
                FUNCTIONS_WORKER_RUNTIME: "dotnet-isolated",
                WEBSITE_RUN_FROM_PACKAGE: "1",
            },

            siteConfig: {
                linuxFxVersion: "DOTNET-ISOLATED|8.0", // Using .NET 8 isolated process
            },
        });

        // Storage Account Output
        new TerraformOutput(this, "storageAccountName", {
            value: storageAccount.name,
        });

        // Storage Container Output
        new TerraformOutput(this, "storageContainerName", {
            value: storageContainer.name,
        });
    }
}
