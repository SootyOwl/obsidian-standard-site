import {
	LocalActorResolver,
	CompositeDidDocumentResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
	WellKnownHandleResolver,
	DohJsonHandleResolver,
	CompositeHandleResolver,
} from "@atcute/identity-resolver";
import type { Did, Handle } from "@atcute/lexicons/syntax";

export interface ResolvedIdentity {
	did: Did;
	pds: string;
}

export async function resolveIdentity(identifier: string): Promise<ResolvedIdentity> {
	const resolver = new LocalActorResolver({
		handleResolver: new CompositeHandleResolver({
			methods: {
				dns: new DohJsonHandleResolver({ dohUrl: 'https://mozilla.cloudflare-dns.com/dns-query' }),
				http: new WellKnownHandleResolver(),
			},
		}),
		didDocumentResolver: new CompositeDidDocumentResolver({
			methods: {
				plc: new PlcDidDocumentResolver(),
				web: new WebDidDocumentResolver(),
			},
		}),
	});
	const result = await resolver.resolve(identifier as Handle | Did);
	return { did: result.did, pds: result.pds };
}
