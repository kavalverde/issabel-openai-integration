import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Configurar CORS
  app.enableCors();
  
  // Obtener puerto de configuración
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;
  
  await app.listen(port);
  logger.log(`Aplicación iniciada en: http://localhost:${port}`);
}
bootstrap();