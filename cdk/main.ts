import { App } from "cdktf";
import { StorageStack } from "./src/storage-stack";

const app = new App();
new StorageStack(app, "storage-stack");
app.synth();
