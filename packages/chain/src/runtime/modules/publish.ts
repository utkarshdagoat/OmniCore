import { Bool, Bytes, PublicKey, Struct, Provable, Field } from "o1js";
import runtime from "..";
import { runtimeMethod, RuntimeModule, runtimeModule, state } from "@proto-kit/module";
import { assert, State, StateMap } from "@proto-kit/protocol";
import { inject } from "tsyringe";
import { StakingRegistry } from "./staking";
import { Balance, TokenId, UInt64, UInt32 } from "@proto-kit/library";
import { Balances } from "./balance";
import { Prover } from "o1js/dist/node/lib/proof-system/zkprogram";
import { asProver } from "o1js/dist/node/lib/provable/core/provable-context";
/**
 * Task
 * @param name - The name of the task
 * @param epochs - The number of epochs
 * @param modelType - The type of model 1 - CNN, 2 - RNN, 3 - LSTM
 * @param modelSize - The size of the model
 * @param numOfLayers - The number of layers
 * @param activationFunction - The activation function 1 - ReLU, 2 - Sigmoid, 3 - Tanh
 * @param Optimizer - The optimizer 1 - SGD, 2 - Adam, 3 - RMSprop
 * @param completed - Whether the task is completed
 * @param publisher - The public key of the publisher
 * @param feePerEpoch - The fee per epoch
 */
export class Task extends Struct({
  epochs: UInt64,
  modelType: UInt64,
  modelSize: UInt64,
  numOfLayers: UInt64,
  activationFunction: UInt64,
  Optimizer: UInt64,
  completed: Bool,
  publisher: PublicKey,
  feePerEpoch: UInt64,
}) {
  public static from(
    epochs: UInt64,
    modelType: UInt64,
    modelSize: UInt64,
    numOfLayers: UInt64,
    activationFunction: UInt64,
    Optimizer: UInt64,
    completed: Bool,
    publisher: PublicKey,
    feePerEpoch: UInt64,
  ): Task {
    return new Task({
      epochs,
      modelType,
      modelSize,
      numOfLayers,
      activationFunction,
      Optimizer,
      completed,
      publisher,
      feePerEpoch,
    });
  }


};
interface PublisherConfig {
  address: PublicKey;
}

@runtimeModule()
export class Publisher extends RuntimeModule<PublisherConfig> {
  @state() public TASKS_LENGTH = State.from<UInt64>(UInt64);
  @state() public tasks = StateMap.from<UInt64, Task>(UInt64, Task);
  @state() public clients = StateMap.from<UInt64, Array<PublicKey>>(UInt64, Provable.Array(PublicKey, 3));
  @state() public clientsIndex = StateMap.from<UInt64, UInt64>(UInt64,UInt64);

  constructor(
    @inject("StakingRegistry") public stakingRegistry: StakingRegistry,
    @inject("Balances") public balances: Balances,
  ) {
    super();
  }

  @runtimeMethod()
  public async addTask(
    epochs: UInt64,
    modelType: UInt64,
    modelSize: UInt64,
    numOfLayers: UInt64,
    activationFunction: UInt64,
    Optimizer: UInt64,
    feePerEpoch: UInt64
  ): Promise<void> {
    const totalFee = feePerEpoch.mul(epochs);
    assert(totalFee.greaterThan(UInt64.from(0)), "Fee must be greater than 0");
    await this.balances.transfer(
      TokenId.from(0),
      this.transaction.sender.value,
      this.config.address,
      totalFee
    )
    const tasksLength = await this.TASKS_LENGTH.get();
    const task = Task.from(
      epochs,
      modelType,
      modelSize,
      numOfLayers,
      activationFunction,
      Optimizer,
      Bool.fromValue(false),
      this.transaction.sender.value,
      feePerEpoch,
    );
    await this.tasks.set(tasksLength.value, task);
    const clients = Array<PublicKey>(3).fill(PublicKey.empty());
    await this.clients.set(tasksLength.value, clients);
    const incrementTl = tasksLength.value.add(1);
    this.TASKS_LENGTH.set(incrementTl);
  }

  @runtimeMethod()
  public async completeTask(taskId: UInt64): Promise<void> {
    const sender = this.transaction.sender.value;
    const task = await this.tasks.get(taskId);

    assert(task.value.publisher.equals(sender), "Only the publisher can complete the task");

    task.value.completed = Bool.fromValue(true);
    await this.tasks.set(taskId, task.value);
    await this._distributeFunds(taskId);
  }

  async _distributeFunds(taskId: UInt64) {
    const task = await this.tasks.get(taskId);
    const clients = (await this.clients.get(taskId)).value;
    const selfAddr = this.config.address;
    const feePerEpoch = task.value.feePerEpoch;
    const epochs = task.value.epochs;
    const totalFee = feePerEpoch.mul(epochs);
    const feePerClient = totalFee.div(UInt64.from(clients.length));
    for (const client of clients) {
      await this.balances.transfer(
        TokenId.from(0),
        selfAddr,
        client,
        feePerClient
      );
    }
  }


  ///Wanted to find the empty array index and could not so I all the three clients
  /// Not scalable :(
  @runtimeMethod()
  public async addClients(

    taskId: UInt64, 
    clientOne:PublicKey,
    clientTwo:PublicKey,
    clientThree:PublicKey
  ): Promise<void> {
   
    asProver(()=>{
      console.log(clientOne.toBase58())
      console.log(clientTwo.toBase58())
      console.log(clientThree.toBase58())
    })
    const newClients = [clientOne, clientTwo, clientThree];
    await this.clients.set(taskId, newClients);
  }

  @runtimeMethod()
  public async getTask(taskId: UInt64): Promise<Task> {
    return (await this.tasks.get(taskId)).value;
  }

}
