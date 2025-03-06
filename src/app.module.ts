import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AriModule } from './ari/ari.module';
import { OpenaiModule } from './openai/openai.module';
import { CallsModule } from './calls/calls.module';
import configuration from './config/configuration';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'temp') || '',
      serveRoot: '/audio',
      // Opcional: configuraciones adicionales
      serveStaticOptions: {
        index: false, // No mostrar listado de archivos
        maxAge: '1d' // Cache de 1 día
      }
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    AriModule,
    OpenaiModule,
    CallsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}