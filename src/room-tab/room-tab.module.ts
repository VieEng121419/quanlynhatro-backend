import { Module } from '@nestjs/common';
import { RoomTabController } from './room-tab.controller';
import { RoomTabService } from './room-tab.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [RoomTabController],
  providers: [RoomTabService],
})
export class RoomTabModule {}
