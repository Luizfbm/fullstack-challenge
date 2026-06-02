import { Module } from "@nestjs/common";
import { autoBetProviders } from "./infrastructure/providers/auto-bet.providers";
import { bettingProviders } from "./infrastructure/providers/betting.providers";
import { coreGameProviders } from "./infrastructure/providers/core-game.providers";
import { gameQueryProviders } from "./infrastructure/providers/game-query.providers";
import { roundLifecycleProviders } from "./infrastructure/providers/round-lifecycle.providers";
import { AutoBetController } from "./presentation/controllers/auto-bet.controller";
import { GamesController } from "./presentation/controllers/games.controller";

@Module({
  controllers: [GamesController, AutoBetController],
  providers: [
    ...coreGameProviders,
    ...roundLifecycleProviders,
    ...gameQueryProviders,
    ...autoBetProviders,
    ...bettingProviders,
  ],
})
export class AppModule {}
