import { AtpAgent } from "@atproto/api";
import type { DocumentRecord, PublicationRecord } from "./types";

export interface RecordRef {
	uri: string;
	cid: string;
}

export interface ListedRecord {
	uri: string;
	cid: string;
	value: any;
}

export class StandardSiteClient {
	private agent: AtpAgent;

	constructor(serviceUrl: string) {
		this.agent = new AtpAgent({ service: serviceUrl });
	}

	get did(): string {
		if (!this.agent.did) {
			throw new Error("StandardSiteClient is not logged in. Call login() before accessing did.");
		}
		return this.agent.did;
	}

	async login(identifier: string, password: string): Promise<void> {
		await this.agent.login({ identifier, password });
	}

	async createPublication(record: PublicationRecord): Promise<RecordRef> {
		const response = await this.agent.com.atproto.repo.createRecord({
			repo: this.did,
			collection: "site.standard.publication",
			record: record as unknown as Record<string, unknown>,
		});
		return { uri: response.data.uri, cid: response.data.cid };
	}

	async updatePublication(rkey: string, record: PublicationRecord): Promise<RecordRef> {
		const response = await this.agent.com.atproto.repo.putRecord({
			repo: this.did,
			collection: "site.standard.publication",
			rkey,
			record: record as unknown as Record<string, unknown>,
		});
		return { uri: response.data.uri, cid: response.data.cid };
	}

	async getPublication(rkey: string): Promise<ListedRecord | null> {
		try {
			const response = await this.agent.com.atproto.repo.getRecord({
				repo: this.did,
				collection: "site.standard.publication",
				rkey,
			});
			return { uri: response.data.uri, cid: response.data.cid ?? "", value: response.data.value };
		} catch {
			return null;
		}
	}

	async listPublications(): Promise<ListedRecord[]> {
		const allRecords: ListedRecord[] = [];
		let cursor: string | undefined;

		do {
			const response = await this.agent.com.atproto.repo.listRecords({
				repo: this.did,
				collection: "site.standard.publication",
				limit: 100,
				cursor,
			});
			for (const record of response.data.records) {
				allRecords.push({
					uri: record.uri,
					cid: record.cid,
					value: record.value,
				});
			}
			cursor = response.data.cursor;
		} while (cursor);

		return allRecords;
	}

	async createDocument(record: DocumentRecord): Promise<RecordRef> {
		const response = await this.agent.com.atproto.repo.createRecord({
			repo: this.did,
			collection: "site.standard.document",
			record: record as unknown as Record<string, unknown>,
		});
		return { uri: response.data.uri, cid: response.data.cid };
	}

	async updateDocument(rkey: string, record: DocumentRecord): Promise<RecordRef> {
		const response = await this.agent.com.atproto.repo.putRecord({
			repo: this.did,
			collection: "site.standard.document",
			rkey,
			record: record as unknown as Record<string, unknown>,
		});
		return { uri: response.data.uri, cid: response.data.cid };
	}

	async deleteDocument(rkey: string): Promise<void> {
		await this.agent.com.atproto.repo.deleteRecord({
			repo: this.did,
			collection: "site.standard.document",
			rkey,
		});
	}

	async getDocument(rkey: string): Promise<ListedRecord | null> {
		try {
			const response = await this.agent.com.atproto.repo.getRecord({
				repo: this.did,
				collection: "site.standard.document",
				rkey,
			});
			return { uri: response.data.uri, cid: response.data.cid ?? "", value: response.data.value };
		} catch {
			return null;
		}
	}

	async listDocuments(): Promise<ListedRecord[]> {
		const allRecords: ListedRecord[] = [];
		let cursor: string | undefined;

		do {
			const response = await this.agent.com.atproto.repo.listRecords({
				repo: this.did,
				collection: "site.standard.document",
				limit: 100,
				cursor,
			});
			for (const record of response.data.records) {
				allRecords.push({
					uri: record.uri,
					cid: record.cid,
					value: record.value,
				});
			}
			cursor = response.data.cursor;
		} while (cursor);

		return allRecords;
	}

	extractRkey(uri: string): string {
		const parts = uri.split("/");
		return parts[parts.length - 1] ?? "";
	}
}
