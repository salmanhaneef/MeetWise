import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import prisma  from '@/lib/prisma' // adjust to your prisma client path

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Get the user from DB using clerkId
    const user = await prisma.user.findUnique({
      where: { clerkId }
    })

    if (!user) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'no file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'invalid file type' }, { status: 400 })
    }

    // Validate file size (2MB limit)
    const MAX_SIZE = 2 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'file too large (max 2MB)' }, { status: 400 })
    }

    const fileExtension = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExtension}`

    const buffer = Buffer.from(await file.arrayBuffer())

    // Delete old bot image if exists
    if (user.botImageUrl) {
      const oldFileName = user.botImageUrl.split('/').pop()
      if (oldFileName) {
        await supabase.storage
          .from('bot-avatars')
          .remove([oldFileName])
      }
    }

    // Upload new image
    const { error: uploadError } = await supabase.storage
      .from('bot-avatars')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return NextResponse.json({ error: 'failed to upload image' }, { status: 500 })
    }

    // Get public URL
    const { data } = supabase.storage
      .from('bot-avatars')
      .getPublicUrl(fileName)

    // Update user's botImageUrl in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { botImageUrl: data.publicUrl }
    })

    return NextResponse.json({
      success: true,
      url: data.publicUrl
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'failed to upload image' }, { status: 500 })
  }
}