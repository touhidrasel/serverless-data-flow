using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

public class BlobUploaderFunction
{
    private readonly ILogger<BlobUploaderFunction> _logger;
    private readonly BlobServiceClient _blobServiceClient;
    private readonly HttpClient _httpClient;

    public BlobUploaderFunction(ILogger<BlobUploaderFunction> logger)
    {
        _logger = logger;
        _blobServiceClient = new BlobServiceClient(Environment.GetEnvironmentVariable("AzureWebJobsStorage"));
        _httpClient = new HttpClient();
    }

    [Function("BlobUploaderFunction")]
    public async Task Run([TimerTrigger("0 */25 * * * *")] TimerInfo timer)
    {
        Stopwatch stopwatch = Stopwatch.StartNew();
        string timestamp = DateTime.UtcNow.ToString("o"); // ISO 8601 format
        string uniqueId = Guid.NewGuid().ToString(); // Unique file identifier

        string fileName = $"{DateTime.UtcNow:yyyy/MM/dd/HH}/{uniqueId}.json"; // Organized structure

        try
        {
            _logger.LogInformation($"Function started at {timestamp}");

            var metadata = new
            {
                timestamp,
                executionDurationMs = 0, // Will update after execution
                instanceId = Environment.MachineName,
                functionName = "BlobUploaderFunction",
                status = "Success"
            };

            var blobContainer = _blobServiceClient.GetBlobContainerClient(Environment.GetEnvironmentVariable("AZURE_STORAGE_CONTAINER"));
            await blobContainer.CreateIfNotExistsAsync(PublicAccessType.None);

            BlobClient blobClient = blobContainer.GetBlobClient(fileName);
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(System.Text.Json.JsonSerializer.Serialize(metadata)));

            await blobClient.UploadAsync(stream, overwrite: true);

            stopwatch.Stop();
            _logger.LogInformation($"File {fileName} uploaded successfully in {stopwatch.ElapsedMilliseconds} ms.");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError($"Error uploading file: {ex.Message}");
        }
    }

}
