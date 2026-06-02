import { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import * as amqp from "amqplib";
import type { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import {
  WalletCommand,
  WalletCommandHandler,
  WalletCommandResponse,
} from "./wallet-command-handler";

const WALLET_COMMAND_QUEUE = "wallet.commands";

export class RabbitMqWalletServer implements OnModuleInit, OnModuleDestroy {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    private readonly walletCommandHandler: WalletCommandHandler,
    private readonly rabbitMqUrl: string,
    private readonly queueName = WALLET_COMMAND_QUEUE,
  ) {}

  async onModuleInit(): Promise<void> {
    this.connection = await amqp.connect(this.rabbitMqUrl);
    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue(this.queueName, { durable: true });
    await this.channel.prefetch(16);
    await this.channel.consume(this.queueName, (message) => {
      void this.handleMessage(message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async handleMessage(message: ConsumeMessage | null): Promise<void> {
    if (!message || !this.channel) {
      return;
    }

    try {
      const response = await this.handlePayload(message.content);

      if (message.properties.replyTo) {
        this.channel.sendToQueue(
          message.properties.replyTo,
          Buffer.from(JSON.stringify(response)),
          {
            correlationId: message.properties.correlationId,
            contentType: "application/json",
            persistent: true,
          },
        );
      }

      this.channel.ack(message);
    } catch {
      this.channel.nack(message, false, true);
    }
  }

  private async handlePayload(content: Buffer): Promise<WalletCommandResponse> {
    try {
      const command = JSON.parse(content.toString()) as WalletCommand;

      return await this.walletCommandHandler.handle(command);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "INVALID_WALLET_COMMAND",
          message:
            error instanceof Error ? error.message : "Invalid wallet command",
        },
      };
    }
  }
}
