import { Module } from '@nestjs/common';
import { RoomTabController } from './room-tab.controller';
import { RoomTabService } from './room-tab.service';

@Module({
  controllers: [RoomTabController],
  providers: [RoomTabService]
})
export class RoomTabModule {}
