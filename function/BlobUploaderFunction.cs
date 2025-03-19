using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Microsoft.Azure.Cosmos;

public class CosmosDbUploaderFunction
{
    private readonly ILogger<CosmosDbUploaderFunction> _logger;
    private readonly CosmosClient _cosmosClient;
    private readonly Container _container;

    public CosmosDbUploaderFunction(ILogger<CosmosDbUploaderFunction> logger)
    {
        _logger = logger;

        string cosmosDbConnectionString = Environment.GetEnvironmentVariable("COSMOSDB_CONNECTION_STRING");
        string databaseName = Environment.GetEnvironmentVariable("COSMOSDB_DATABASE_NAME");
        string containerName = Environment.GetEnvironmentVariable("COSMOSDB_CONTAINER_NAME");

        if (string.IsNullOrEmpty(cosmosDbConnectionString))
        {
            _logger.LogError("❌ Missing CosmosDB connection string.");
            throw new Exception("COSMOSDB_CONNECTION_STRING is not set.");
        }

        if (string.IsNullOrEmpty(databaseName) || string.IsNullOrEmpty(containerName))
        {
            _logger.LogError("❌ Missing CosmosDB database or container name.");
            throw new Exception("COSMOSDB_DATABASE_NAME or COSMOSDB_CONTAINER_NAME is not set.");
        }

        try
        {
            _cosmosClient = new CosmosClient(cosmosDbConnectionString);
            _container = _cosmosClient.GetDatabase(databaseName).GetContainer(containerName);
            _logger.LogInformation("✅ Successfully connected to CosmosDB.");
        }
        catch (Exception ex)
        {
            _logger.LogError($"❌ Failed to initialize CosmosDB client: {ex.Message}");
            throw;
        }
    }

    [Function("CosmosDbUploaderFunction")]
    public async Task Run([TimerTrigger("0 */65 * * * *")] TimerInfo timer)
    {
        _logger.LogInformation($"Function executed at: {DateTime.UtcNow}");

        var data = new Dictionary<string, object>
        {
            { "id", Guid.NewGuid().ToString() }, // Required by CosmosDB
            { "timestamp", DateTime.UtcNow.ToString("o") }, // ISO 8601 format
            { "partitionKey", "uploads" } // Define partition key
        };

        try
        {
            await _container.CreateItemAsync(data, new PartitionKey("uploads"));
            _logger.LogInformation("✅ Successfully uploaded data to CosmosDB.");
        }
        catch (CosmosException cosmosEx)
        {
            _logger.LogError($"❌ CosmosDB Error: {cosmosEx.StatusCode} - {cosmosEx.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"❌ General Error: {ex.Message}");
        }
    }
}
