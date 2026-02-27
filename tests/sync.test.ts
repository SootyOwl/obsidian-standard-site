import { describe, it, expect } from "vitest";
import { computeSyncDiff, type VaultNote, type PdsRecord } from "../src/sync";

describe("computeSyncDiff", () => {
	it("identifies notes to create (published in vault, not on PDS)", () => {
		const vaultNotes: VaultNote[] = [
			{ filePath: "post-a.md", path: "/post-a", rkey: undefined },
		];
		const pdsRecords: PdsRecord[] = [];

		const diff = computeSyncDiff(vaultNotes, pdsRecords);
		expect(diff.toCreate).toHaveLength(1);
		expect(diff.toCreate[0].filePath).toBe("post-a.md");
		expect(diff.toUpdate).toHaveLength(0);
		expect(diff.orphans).toHaveLength(0);
	});

	it("identifies notes to update (have rkey matching PDS record)", () => {
		const vaultNotes: VaultNote[] = [
			{ filePath: "post-a.md", path: "/post-a", rkey: "abc123" },
		];
		const pdsRecords: PdsRecord[] = [
			{ uri: "at://did:plc:test/site.standard.document/abc123", rkey: "abc123", path: "/post-a", value: {} },
		];

		const diff = computeSyncDiff(vaultNotes, pdsRecords);
		expect(diff.toUpdate).toHaveLength(1);
		expect(diff.toCreate).toHaveLength(0);
	});

	it("identifies orphans (on PDS but not in vault)", () => {
		const vaultNotes: VaultNote[] = [];
		const pdsRecords: PdsRecord[] = [
			{ uri: "at://did:plc:test/site.standard.document/orphan1", rkey: "orphan1", path: "/old-post", value: {} },
		];

		const diff = computeSyncDiff(vaultNotes, pdsRecords);
		expect(diff.orphans).toHaveLength(1);
		expect(diff.orphans[0].rkey).toBe("orphan1");
	});

	it("matches vault notes to PDS records by path when rkey is missing", () => {
		const vaultNotes: VaultNote[] = [
			{ filePath: "post-a.md", path: "/post-a", rkey: undefined },
		];
		const pdsRecords: PdsRecord[] = [
			{ uri: "at://did:plc:test/site.standard.document/xyz789", rkey: "xyz789", path: "/post-a", value: {} },
		];

		const diff = computeSyncDiff(vaultNotes, pdsRecords);
		expect(diff.toUpdate).toHaveLength(1);
		expect(diff.toUpdate[0].rkey).toBe("xyz789");
		expect(diff.toCreate).toHaveLength(0);
		expect(diff.orphans).toHaveLength(0);
	});

	it("handles mixed scenario", () => {
		const vaultNotes: VaultNote[] = [
			{ filePath: "new-post.md", path: "/new-post", rkey: undefined },
			{ filePath: "existing.md", path: "/existing", rkey: "exist1" },
		];
		const pdsRecords: PdsRecord[] = [
			{ uri: "at://did:plc:test/site.standard.document/exist1", rkey: "exist1", path: "/existing", value: {} },
			{ uri: "at://did:plc:test/site.standard.document/gone1", rkey: "gone1", path: "/deleted-post", value: {} },
		];

		const diff = computeSyncDiff(vaultNotes, pdsRecords);
		expect(diff.toCreate).toHaveLength(1);
		expect(diff.toUpdate).toHaveLength(1);
		expect(diff.orphans).toHaveLength(1);
	});
});
