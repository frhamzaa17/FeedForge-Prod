import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: '0.5-show-api',
      storage: 'local-file',
      timestamp: new Date().toISOString(),
    }
  }
}
