import {
	LocalActorResolver,
	XrpcHandleResolver,
	CompositeDidDocumentResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
} from "@atcute/identity-resolver";
import type { Did, Handle } from "@atcute/lexicons/syntax";

export interface ResolvedIdentity {
	did: Did;
	pds: string;
}

export async function resolveIdentity(handle: string): Promise<ResolvedIdentity> {
	const resolver = new LocalActorResolver({
		handleResolver: new XrpcHandleResolver({ serviceUrl: "https://public.api.bsky.app" }),
		didDocumentResolver: new CompositeDidDocumentResolver({
			methods: {
				plc: new PlcDidDocumentResolver(),
				web: new WebDidDocumentResolver(),
			},
		}),
	});
	const result = await resolver.resolve(handle as Handle);
	return { did: result.did, pds: result.pds };
}
