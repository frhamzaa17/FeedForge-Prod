import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common'
import type { CreatePostInput, Platform, PostStatus } from '@zpf/shared'
import { Req } from '@nestjs/common'
import { currentUserId } from '../../auth/http-session'
import { LocalStore } from '../../store/local.store'

const platforms: Platform[] = ['instagram', 'facebook', 'linkedin', 'x', 'youtube', 'tiktok', 'threads', 'reddit']
const validStatuses: PostStatus[] = [
  'draft',
  'pending_approval',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'archived',
]

@Controller('posts')
export class PostsController {
  constructor(private readonly store: LocalStore) {}

  @Get()
  getPosts(@Req() request: { headers?: { cookie?: string } }, @Query('status') status?: PostStatus) {
    if (status && !validStatuses.includes(status)) {
      throw new BadRequestException('Unknown post status')
    }
    return this.store.getPosts(currentUserId(this.store, request), status)
  }

  @Get(':id')
  getPost(@Req() request: { headers?: { cookie?: string } }, @Param('id') id: string) {
    const post = this.store.getPost(currentUserId(this.store, request), id)
    if (!post) throw new NotFoundException('Post not found')
    return post
  }

  @Post()
  createPost(@Req() request: { headers?: { cookie?: string } }, @Body() input: CreatePostInput) {
    const userId = currentUserId(this.store, request)
    this.validateCreate(userId, input)
    return this.store.createPost(userId, input)
  }

  @Patch(':id/status')
  async updateStatus(@Req() request: { headers?: { cookie?: string } }, @Param('id') id: string, @Body() body: { status: PostStatus }) {
    if (!validStatuses.includes(body.status)) {
      throw new BadRequestException('Unknown post status')
    }
    const post = await this.store.updateStatus(currentUserId(this.store, request), id, body.status)
    if (!post) throw new NotFoundException('Post not found')
    return post
  }

  @Post(':id/retry')
  async retry(@Req() request: { headers?: { cookie?: string } }, @Param('id') id: string) {
    const post = await this.store.retry(currentUserId(this.store, request), id)
    if (!post) throw new NotFoundException('Post not found')
    return post
  }

  @Post(':id/publish')
  async publish(@Req() request: { headers?: { cookie?: string } }, @Param('id') id: string) {
    const post = await this.store.publishPost(currentUserId(this.store, request), id)
    if (!post) throw new NotFoundException('Post not found')
    return post
  }

  private validateCreate(userId: string, input: CreatePostInput) {
    if (!input?.title?.trim()) throw new BadRequestException('Title is required')
    if (!input?.text?.trim()) throw new BadRequestException('Post copy is required')
    if (!Array.isArray(input.targetAccountIds) || input.targetAccountIds.length === 0) {
      throw new BadRequestException('Choose at least one target account')
    }

    const accountPlatforms = new Set(
      this.store.getAccounts(userId)
        .filter((account) => input.targetAccountIds.includes(account.id))
        .map((account) => account.platform),
    )

    if (accountPlatforms.size === 0) throw new BadRequestException('No valid target accounts selected')
    if ([...accountPlatforms].some((platform) => !platforms.includes(platform))) {
      throw new BadRequestException('Unsupported target platform')
    }
    if (accountPlatforms.has('instagram') && input.contentType === 'text') {
      throw new BadRequestException('Instagram does not support text-only posts')
    }
    if (accountPlatforms.has('threads') && input.text.length > 500) {
      throw new BadRequestException('Threads posts cannot exceed 500 characters')
    }
    if (input.scheduledAt && Number.isNaN(Date.parse(input.scheduledAt))) {
      throw new BadRequestException('scheduledAt must be a valid date')
    }
  }
}
