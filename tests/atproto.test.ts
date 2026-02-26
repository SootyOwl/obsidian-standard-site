import { describe, it, expect, vi, beforeEach } from "vitest";
import { StandardSiteClient } from "../src/atproto";
import type { DocumentRecord, PublicationRecord } from "../src/types";

// Mock the @atproto/api module
vi.mock("@atproto/api", () => {
	const mockAgent = {
		login: vi.fn(),
		did: "did:plc:testuser123",
		com: {
			atproto: {
				repo: {
					createRecord: vi.fn(),
					putRecord: vi.fn(),
					deleteRecord: vi.fn(),
					getRecord: vi.fn(),
					listRecords: vi.fn(),
				},
				identity: {
					resolveHandle: vi.fn(),
				},
			},
		},
	};
	return {
		AtpAgent: vi.fn(function () { return mockAgent; }),
		__mockAgent: mockAgent,
	};
});

// Get the mock agent for assertions
async function getMockAgent() {
	const mod = await import("@atproto/api");
	return (mod as any).__mockAgent;
}

describe("StandardSiteClient", () => {
	let client: StandardSiteClient;
	let mockAgent: any;

	beforeEach(async () => {
		mockAgent = await getMockAgent();
		vi.clearAllMocks();
		client = new StandardSiteClient("https://bsky.social");
	});

	describe("login", () => {
		it("calls agent.login with identifier and password", async () => {
			mockAgent.login.mockResolvedValue({ success: true });
			await client.login("alice.bsky.social", "app-password-123");
			expect(mockAgent.login).toHaveBeenCalledWith({
				identifier: "alice.bsky.social",
				password: "app-password-123",
			});
		});
	});

	describe("createDocument", () => {
		it("calls createRecord with correct collection and record", async () => {
			const doc: DocumentRecord = {
				$type: "site.standard.document",
				site: "at://did:plc:testuser123/site.standard.publication/self",
				title: "Test Post",
				path: "/test-post",
				publishedAt: "2026-02-26T12:00:00.000Z",
				textContent: "test",
				content: { $type: "at.markpub.markdown", text: "test", flavor: "GFM" },
			};

			mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
				data: { uri: "at://did:plc:testuser123/site.standard.document/abc123", cid: "cid123" },
			});

			const result = await client.createDocument(doc);

			expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalledWith({
				repo: "did:plc:testuser123",
				collection: "site.standard.document",
				record: doc,
			});
			expect(result.uri).toBe("at://did:plc:testuser123/site.standard.document/abc123");
		});
	});

	describe("updateDocument", () => {
		it("calls putRecord with rkey", async () => {
			const doc: DocumentRecord = {
				$type: "site.standard.document",
				site: "at://did:plc:testuser123/site.standard.publication/self",
				title: "Updated Post",
				path: "/test-post",
				publishedAt: "2026-02-26T12:00:00.000Z",
				textContent: "updated",
				content: { $type: "at.markpub.markdown", text: "updated", flavor: "GFM" },
			};

			mockAgent.com.atproto.repo.putRecord.mockResolvedValue({
				data: { uri: "at://did:plc:testuser123/site.standard.document/abc123", cid: "cid456" },
			});

			await client.updateDocument("abc123", doc);

			expect(mockAgent.com.atproto.repo.putRecord).toHaveBeenCalledWith({
				repo: "did:plc:testuser123",
				collection: "site.standard.document",
				rkey: "abc123",
				record: doc,
			});
		});
	});

	describe("deleteDocument", () => {
		it("calls deleteRecord with rkey", async () => {
			mockAgent.com.atproto.repo.deleteRecord.mockResolvedValue({ success: true });
			await client.deleteDocument("abc123");

			expect(mockAgent.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
				repo: "did:plc:testuser123",
				collection: "site.standard.document",
				rkey: "abc123",
			});
		});
	});

	describe("listDocuments", () => {
		it("returns all document records", async () => {
			mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
				data: {
					records: [
						{
							uri: "at://did:plc:testuser123/site.standard.document/abc123",
							value: { title: "Post 1", path: "/post-1" },
						},
					],
					cursor: undefined,
				},
			});

			const records = await client.listDocuments();
			expect(records).toHaveLength(1);
			expect(records[0].value.title).toBe("Post 1");
		});
	});

	describe("getDocument", () => {
		it("returns a document by rkey", async () => {
			mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
				data: {
					uri: "at://did:plc:testuser123/site.standard.document/abc123",
					value: { title: "Post 1" },
				},
			});

			const record = await client.getDocument("abc123");
			expect(record.value.title).toBe("Post 1");
		});

		it("returns null when record not found", async () => {
			mockAgent.com.atproto.repo.getRecord.mockRejectedValue(
				new Error("Record not found")
			);

			const record = await client.getDocument("nonexistent");
			expect(record).toBeNull();
		});
	});
});
