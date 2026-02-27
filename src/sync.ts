export interface VaultNote {
	filePath: string;
	path: string;
	rkey: string | undefined;
}

export interface PdsRecord {
	uri: string;
	rkey: string;
	path: string;
	value: any;
}

export interface SyncDiff {
	toCreate: VaultNote[];
	toUpdate: Array<VaultNote & { rkey: string }>;
	orphans: PdsRecord[];
}

export function computeSyncDiff(vaultNotes: VaultNote[], pdsRecords: PdsRecord[]): SyncDiff {
	const toCreate: VaultNote[] = [];
	const toUpdate: Array<VaultNote & { rkey: string }> = [];
	const matchedPdsRkeys = new Set<string>();

	// Build a lookup of PDS records by path
	const pdsByPath = new Map<string, PdsRecord>();
	for (const record of pdsRecords) {
		if (record.path) {
			pdsByPath.set(record.path, record);
		}
	}

	// Build a lookup of PDS records by rkey
	const pdsByRkey = new Map<string, PdsRecord>();
	for (const record of pdsRecords) {
		pdsByRkey.set(record.rkey, record);
	}

	for (const note of vaultNotes) {
		// First try to match by rkey (fast path)
		if (note.rkey) {
			const pdsRecord = pdsByRkey.get(note.rkey);
			if (pdsRecord) {
				toUpdate.push({ ...note, rkey: note.rkey });
				matchedPdsRkeys.add(pdsRecord.rkey);
				continue;
			}
		}

		// Fall back to matching by path
		const pdsRecord = pdsByPath.get(note.path);
		if (pdsRecord) {
			toUpdate.push({ ...note, rkey: pdsRecord.rkey });
			matchedPdsRkeys.add(pdsRecord.rkey);
		} else {
			toCreate.push(note);
		}
	}

	// Orphans: PDS records not matched to any vault note
	const orphans = pdsRecords.filter((r) => !matchedPdsRkeys.has(r.rkey));

	return { toCreate, toUpdate, orphans };
}
