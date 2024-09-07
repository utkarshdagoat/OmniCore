import { runtimeMethod, runtimeModule, RuntimeModule, state } from "@proto-kit/module";
import { PublicKey, Struct, Bool } from "o1js";
import { inject } from "tsyringe";
import { UInt64 } from "@proto-kit/library";
import { StateMap } from "@proto-kit/protocol";
import { LayerProof } from "../zkPrograms/layer";

interface AggregatorConfig { }

export class ClientTaskKey extends Struct({
    taskId: UInt64,
    clientId: PublicKey
}) { }

export class Aggregator extends RuntimeModule<AggregatorConfig> {
    @state() public clientsProofVerified = StateMap.from<ClientTaskKey, Bool>(ClientTaskKey, Bool);


    @runtimeMethod()
    public async verifyInfrence(
        taskId: UInt64,
        clientId: PublicKey,
        proof: LayerProof
    ) {
        proof.verify()
        this.clientsProofVerified.set(new ClientTaskKey({ taskId, clientId }), Bool(true))
    }

    @runtimeMethod()
    public async getProofStatus(
        taskId: UInt64,
        clientId: PublicKey
    ) {
        return this.clientsProofVerified.get(new ClientTaskKey({ taskId, clientId }))
    }
}