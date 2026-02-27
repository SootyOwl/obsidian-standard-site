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
				site: "at://did:plc:testuser123/site.standard.publication/3mc7ts3zshc2y",
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
				site: "at://did:plc:testuser123/site.standard.publication/3mc7ts3zshc2y",
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

	describe("createPublication", () => {
		it("calls createRecord without rkey", async () => {
			const pub: PublicationRecord = {
				$type: "site.standard.publication",
				url: "https://example.com",
				name: "My Blog",
			};

			mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
				data: { uri: "at://did:plc:testuser123/site.standard.publication/3mc7ts3zshc2y", cid: "cidpub1" },
			});

			const result = await client.createPublication(pub);

			expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalledWith({
				repo: "did:plc:testuser123",
				collection: "site.standard.publication",
				record: pub,
			});
			// Verify no rkey was passed
			const callArgs = mockAgent.com.atproto.repo.createRecord.mock.calls[0][0];
			expect(callArgs).not.toHaveProperty("rkey");
			expect(result.uri).toBe("at://did:plc:testuser123/site.standard.publication/3mc7ts3zshc2y");
		});
	});

	describe("listPublications", () => {
		it("returns all publication records with pagination", async () => {
			mockAgent.com.atproto.repo.listRecords
				.mockResolvedValueOnce({
					data: {
						records: [
							{
								uri: "at://did:plc:testuser123/site.standard.publication/3mc7ts3zshc2y",
								cid: "cid1",
								value: { name: "Blog 1" },
							},
						],
						cursor: "next",
					},
				})
				.mockResolvedValueOnce({
					data: {
						records: [
							{
								uri: "at://did:plc:testuser123/site.standard.publication/3mc7ts4abcd2z",
								cid: "cid2",
								value: { name: "Blog 2" },
							},
						],
						cursor: undefined,
					},
				});

			const records = await client.listPublications();
			expect(records).toHaveLength(2);
			expect(records[0].value.name).toBe("Blog 1");
			expect(records[1].value.name).toBe("Blog 2");
			expect(mockAgent.com.atproto.repo.listRecords).toHaveBeenCalledWith({
				repo: "did:plc:testuser123",
				collection: "site.standard.publication",
				limit: 100,
				cursor: undefined,
			});
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
