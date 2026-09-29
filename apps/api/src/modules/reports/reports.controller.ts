import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Req, Res } from '@nestjs/common'
import type { ReportTemplate } from '@zpf/shared'
import { currentUserId } from '../../auth/http-session'
import { LocalStore } from '../../store/local.store'

@Controller('reports')
export class ReportsController {
  constructor(private readonly store: LocalStore) {}

  @Get()
  list(@Req() request: { headers?: { cookie?: string } }) {
    return this.store.getReports(currentUserId(this.store, request))
  }

  @Post()
  save(@Req() request: { headers?: { cookie?: string } }, @Body() report: Omit<ReportTemplate, 'id'>) {
    return this.store.saveReport(currentUserId(this.store, request), report)
  }

  @Delete(':id')
  async delete(@Req() request: { headers?: { cookie?: string } }, @Param('id') id: string) {
    const deleted = await this.store.deleteReport(currentUserId(this.store, request), id)
    if (!deleted) throw new NotFoundException('Report not found')
    return { ok: true, report: deleted }
  }

  @Get(':id/export.csv')
  exportCsv(
    @Req() request: { headers?: { cookie?: string } },
    @Param('id') id: string,
    @Res() response: { setHeader: (name: string, value: string) => void; send: (body: string) => void },
  ) {
    const userId = currentUserId(this.store, request)
    const report = this.store.getReport(userId, id)
    const csv = this.store.exportReportCsv(userId, id)
    response.setHeader('Content-Type', 'text/csv; charset=utf-8')
    response.setHeader('Content-Disposition', `attachment; filename="${filenameForReport(report?.name ?? 'Analytics Report')}.csv"`)
    response.send(csv)
  }
}

function filenameForReport(name: string) {
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return safe || 'analytics-report'
}
