import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { LandlordModule } from './landlord/landlord.module';
import { BranchsModule } from './branchs/branchs.module';
import { RoomsModule } from './rooms/rooms.module';
import { ContractModule } from './contract/contract.module';
import { InvoiceModule } from './invoice/invoice.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LandlordModule,
    BranchsModule,
    RoomsModule,
    ContractModule,
    InvoiceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
