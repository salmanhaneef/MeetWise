import prisma from "@/lib/prisma"
import { JiraAPI } from "@/lib/integrations/jira/jira"
import { refreshJiraToken } from "@/lib/integrations/jira/refreshToken"
import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { UserIntegration } from "@/app/generated/prisma";

async function getValidToken(integration: UserIntegration) {
    if (integration.expiresAt && new Date() > integration.expiresAt) {
        const updated = await refreshJiraToken(integration)
        return updated.accessToken
    }

    return integration.accessToken
}

// Helper to get database user from Clerk ID
async function getDatabaseUser(clerkId: string) {
    return prisma.user.findUnique({
        where: { clerkId: clerkId }
    });
}

export async function GET() {
    const { userId: clerkId } = await auth()

    if (!clerkId) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Get database user
    const user = await getDatabaseUser(clerkId)
    
    if (!user) {
        return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    const integration = await prisma.userIntegration.findUnique({
        where: {
            userId_platform: {
                userId: user.id,  // ✅ Use database UUID
                platform: 'jira'
            }
        }
    })
    
    if (!integration || !integration.workspaceId) {
        return NextResponse.json({ error: 'not connected' }, { status: 400 })
    }

    try {
        const validToken = await getValidToken(integration)
        const jira = new JiraAPI()

        const projects = await jira.getProjects(validToken, integration.workspaceId)
        return NextResponse.json({
            projects: projects.values || []
        })
    } catch (error) {
        console.error('error fetching jira projects:', error)
        return NextResponse.json({ error: 'failed to fetch projects' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const { userId: clerkId } = await auth()

    const { projectId, projectName, projectKey, createNew } = await request.json()

    if (!clerkId) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Get database user
    const user = await getDatabaseUser(clerkId)
    
    if (!user) {
        return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    const integration = await prisma.userIntegration.findUnique({
        where: {
            userId_platform: {
                userId: user.id,  // ✅ Use database UUID
                platform: 'jira'
            }
        }
    })
    
    if (!integration || !integration.workspaceId) {
        return NextResponse.json({ error: 'not connected' }, { status: 400 })
    }

    try {
        const validToken = await getValidToken(integration)

        const jira = new JiraAPI()

        let finalProjectId = projectId
        let finalProjectName = projectName
        let finalProjectKey = projectKey

        if (createNew && projectName) {
            try {
                const suggestedKey = projectName.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10)
                const key = projectKey || suggestedKey
                const newProject = await jira.createProject(
                    validToken,
                    integration.workspaceId,
                    projectName,
                    key
                )
                finalProjectId = newProject.id
                finalProjectName = projectName
                finalProjectKey = newProject.key
            } catch (error) {
                console.error('failed to create project:', error)
                return NextResponse.json({
                    error: 'failed to create project. you may not have admin permissions'
                }, { status: 403 })
            }
        }
        else if (projectId) {
            const projects = await jira.getProjects(validToken, integration.workspaceId)
            const selectedProject = projects.values.find((p: { id: string; key: string; name: string }) => p.id === projectId)

            if (!selectedProject) {
                return NextResponse.json({ error: 'project not found' }, { status: 404 })
            }

            finalProjectKey = selectedProject.key
            finalProjectName = selectedProject.name
        }
        else {
            return NextResponse.json({ error: 'either projectId or createNew with projectName must be provided' }, { status: 400 })
        }

        await prisma.userIntegration.update({
            where: {
                id: integration.id
            },
            data: {
                projectId: finalProjectKey,
                projectName: finalProjectName,
            }
        })

        return NextResponse.json({
            success: true,
            projectId: finalProjectKey,
            projectName: finalProjectName
        })
    } catch (error) {
        console.error('Error setting up jira project:', error)
        return NextResponse.json({ error: 'Failed to setup project' }, { status: 500 })
    }
}