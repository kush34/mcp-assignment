import fs from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BASE_DIR = path.resolve(__dirname, "files-example");

const resolveSafePath = (fileName: string) => {
    const filePath = path.resolve(BASE_DIR, fileName);

    if (
        filePath !== BASE_DIR &&
        !filePath.startsWith(`${BASE_DIR}${path.sep}`)
    ) {
        throw new Error("File path must stay inside files-example");
    }

    return filePath;
};

const formatError = (error: unknown) =>
    error instanceof Error ? error.message : "Unknown error";

export const server = new McpServer(
    {
        name: "filesystem-mcp",
        version: "1.0.0"
    }
);

server.registerTool(
    "list-files",
    {
        description: "List files inside the files-example directory",
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        }
    },
    async () => {
        try {
            const entries = await fs.readdir(BASE_DIR, { withFileTypes: true });
            const files = entries
                .filter(entry => entry.isFile())
                .map(entry => entry.name)
                .sort((left, right) => left.localeCompare(right));

            return {
                content: [
                    {
                        type: "text",
                        text: files.length > 0
                            ? files.join("\n")
                            : "No files found"
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error listing files: ${formatError(error)}`
                    }
                ],
                isError: true
            };
        }
    }
);

server.registerTool(
    "read-file",
    {
        description: "Read a file from the files-example directory",
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        inputSchema: {
            fileName: z.string().min(1)
        }
    },
    async ({ fileName }) => {
        try {
            const filePath = resolveSafePath(fileName);
            const content = await fs.readFile(filePath, "utf-8");

            return {
                content: [
                    {
                        type: "text",
                        text: content
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error reading file: ${formatError(error)}`
                    }
                ],
                isError: true
            };
        }
    }
);

server.registerTool(
    "write-file",
    {
        description: "Write a file inside the files-example directory",
        annotations: {
            idempotentHint: true
        },
        inputSchema: {
            fileName: z.string().min(1),
            content: z.string()
        }
    },
    async ({ fileName, content }) => {
        try {
            const filePath = resolveSafePath(fileName);
            const existingContent = await fs.readFile(filePath, "utf-8").catch(() => null);

            if (existingContent === content) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `File already up to date: ${fileName}`
                        }
                    ]
                };
            }

            await fs.writeFile(filePath, content, "utf-8");

            return {
                content: [
                    {
                        type: "text",
                        text: `File written: ${fileName}`
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error writing file: ${formatError(error)}`
                    }
                ],
                isError: true
            };
        }
    }
);

server.registerTool(
    "delete-file",
    {
        description: "Delete a file from the files-example directory",
        annotations: {
            idempotentHint: true,
            destructiveHint: true
        },
        inputSchema: {
            fileName: z.string().min(1)
        }
    },
    async ({ fileName }) => {
        try {
            const filePath = resolveSafePath(fileName);
            await fs.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
                if (error.code === "ENOENT") {
                    return;
                }

                throw error;
            });

            return {
                content: [
                    {
                        type: "text",
                        text: `File deleted if present: ${fileName}`
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error deleting file: ${formatError(error)}`
                    }
                ],
                isError: true
            };
        }
    }
);

server.registerTool(
    "search-files",
    {
        description: "Search filenames in the files-example directory",
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        inputSchema: {
            searchTerm: z.string().min(1)
        }
    },
    async ({ searchTerm }) => {
        try {
            const entries = await fs.readdir(BASE_DIR, { withFileTypes: true });
            const matches = entries
                .filter(entry => entry.isFile())
                .map(entry => entry.name)
                .filter(fileName =>
                    fileName.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .sort((left, right) => left.localeCompare(right));

            return {
                content: [
                    {
                        type: "text",
                        text: matches.length > 0
                            ? matches.join("\n")
                            : "No matching files found"
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error searching files: ${formatError(error)}`
                    }
                ],
                isError: true
            };
        }
    }
);
