import { DockerContainer } from './container'
import { validateEnvironmentVariables, createAuthenticatedRepoUrl } from '../sandbox/config'
import { generateId } from '@/lib/utils/id'
import { TaskLogger } from '@/lib/utils/task-logger'
import { detectPackageManager, installDependenciesDocker } from './package-manager'
import { SandboxConfig, SandboxResult } from '../sandbox/types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { registerDockerContainer } from './registry'

/**
 * Create and setup a local Docker container for task execution
 */
export async function createDockerSandbox(config: SandboxConfig, logger: TaskLogger): Promise<SandboxResult> {
  let container: DockerContainer | undefined

  try {
    await logger.info(`Repository URL: ${redactSensitiveInfo(config.repoUrl)}`)

    // Check for cancellation before starting
    if (config.onCancellationCheck && (await config.onCancellationCheck())) {
      await logger.info('Task was cancelled before container creation')
      return { success: false, cancelled: true }
    }

    // Call progress callback if provided
    if (config.onProgress) {
      await config.onProgress(20, 'Validating environment variables...')
    }

    // Validate required environment variables
    const envValidation = validateEnvironmentVariables(config.selectedAgent)
    if (!envValidation.valid) {
      throw new Error(envValidation.error!)
    }
    await logger.info('Environment variables validated')

    // Check if Docker is available
    const dockerAvailable = await DockerContainer.isDockerAvailable()
    if (!dockerAvailable) {
      throw new Error(
        'Docker is not available. Please install Docker Desktop and ensure it is running.\nDownload from: https://www.docker.com/products/docker-desktop',
      )
    }

    // Handle private repository authentication
    const authenticatedRepoUrl = createAuthenticatedRepoUrl(config.repoUrl)
    await logger.info('Added GitHub authentication to repository URL')

    // For initial clone, only use existing branch names
    const branchNameForClone = config.existingBranchName

    // Call progress callback before container creation
    if (config.onProgress) {
      await config.onProgress(25, 'Creating Docker container...')
    }

    // Create Docker container
    container = new DockerContainer(
      {
        taskId: config.taskId,
        repoUrl: config.repoUrl,
        branchName: branchNameForClone,
        timeout: config.timeout ? parseInt(config.timeout.replace(/\D/g, '')) * 60 * 1000 : 5 * 60 * 1000,
      },
      logger,
    )

    await container.create()

    // Register container for potential cleanup
    registerDockerContainer(config.taskId, container)

    // Check for cancellation after container creation
    if (config.onCancellationCheck && (await config.onCancellationCheck())) {
      await logger.info('Task was cancelled after container creation')
      return { success: false, cancelled: true }
    }

    // Call progress callback after container creation
    if (config.onProgress) {
      await config.onProgress(30, 'Container created, cloning repository...')
    }

    // Clone repository into container
    await container.cloneRepo(authenticatedRepoUrl, branchNameForClone)

    // Check for cancellation after clone
    if (config.onCancellationCheck && (await config.onCancellationCheck())) {
      await logger.info('Task was cancelled after repository clone')
      return { success: false, cancelled: true }
    }

    // Install project dependencies if requested
    if (config.installDependencies !== false) {
      await logger.info('Detecting project type and installing dependencies...')

      if (config.onProgress) {
        await config.onProgress(35, 'Installing dependencies...')
      }

      // Check for package.json (Node.js project)
      const packageJsonCheck = await container.runCommand('test', ['-f', 'package.json'])

      if (packageJsonCheck.success) {
        await logger.info('package.json found, installing Node.js dependencies...')

        // Detect package manager
        const packageManager = await detectPackageManager(container, logger)

        // Install dependencies
        const installResult = await installDependenciesDocker(container, packageManager, logger)

        if (!installResult.success && packageManager !== 'npm') {
          await logger.info(`${packageManager} failed, trying npm as fallback...`)
          const npmFallback = await installDependenciesDocker(container, 'npm', logger)
          if (!npmFallback.success) {
            await logger.info('Warning: Failed to install dependencies, but continuing...')
          }
        }
      } else {
        // Check for requirements.txt (Python project)
        const requirementsTxtCheck = await container.runCommand('test', ['-f', 'requirements.txt'])

        if (requirementsTxtCheck.success) {
          await logger.info('requirements.txt found, installing Python dependencies...')
          const pipInstall = await container.runCommand('python3', ['-m', 'pip', 'install', '-r', 'requirements.txt'])

          if (!pipInstall.success) {
            await logger.info('Warning: Failed to install Python dependencies, but continuing...')
          } else {
            await logger.info('Python dependencies installed successfully')
          }
        } else {
          await logger.info('No package.json or requirements.txt found, skipping dependency installation')
        }
      }
    } else {
      await logger.info('Skipping dependency installation as requested by user')
    }

    // Configure Git user
    await container.runCommand('git', ['config', '--global', 'user.name', 'Coding Agent'])
    await container.runCommand('git', ['config', '--global', 'user.email', 'agent@example.com'])

    // Configure Git authentication
    if (process.env.GITHUB_TOKEN) {
      await logger.info('Configuring Git authentication with GitHub token')
      const credentialsContent = `https://${process.env.GITHUB_TOKEN}:x-oauth-basic@github.com`
      await container.runCommand('sh', ['-c', `echo "${credentialsContent}" > ~/.git-credentials`])
      await container.runCommand('git', ['config', '--global', 'credential.helper', 'store'])
    }

    // Handle branch creation/checkout
    let branchName: string

    if (config.existingBranchName) {
      // Checkout existing branch
      await logger.info(`Checking out existing branch: ${config.existingBranchName}`)
      const checkoutResult = await container.runCommand('git', ['checkout', config.existingBranchName])

      if (!checkoutResult.success) {
        throw new Error(`Failed to checkout existing branch ${config.existingBranchName}`)
      }

      // Pull latest changes
      await logger.info('Pulling latest changes from remote...')
      await container.runCommand('git', ['pull', 'origin', config.existingBranchName])

      branchName = config.existingBranchName
    } else if (config.preDeterminedBranchName) {
      // Use AI-generated branch name
      await logger.info(`Using pre-determined branch name: ${config.preDeterminedBranchName}`)

      // Check if branch exists locally
      const branchExistsLocal = await container.runCommand('git', [
        'show-ref',
        '--verify',
        '--quiet',
        `refs/heads/${config.preDeterminedBranchName}`,
      ])

      if (branchExistsLocal.success) {
        // Branch exists, checkout
        await container.runCommand('git', ['checkout', config.preDeterminedBranchName])
      } else {
        // Check remote
        const branchExistsRemote = await container.runCommand('git', [
          'ls-remote',
          '--heads',
          'origin',
          config.preDeterminedBranchName,
        ])

        if (branchExistsRemote.success && branchExistsRemote.output?.trim()) {
          // Exists on remote
          await container.runCommand('git', [
            'checkout',
            '-b',
            config.preDeterminedBranchName,
            `origin/${config.preDeterminedBranchName}`,
          ])
        } else {
          // Create new branch
          await logger.info(`Creating new branch: ${config.preDeterminedBranchName}`)
          const createBranch = await container.runCommand('git', ['checkout', '-b', config.preDeterminedBranchName])

          if (!createBranch.success) {
            throw new Error(`Failed to create branch ${config.preDeterminedBranchName}`)
          }
        }
      }

      branchName = config.preDeterminedBranchName
    } else {
      // Fallback: timestamp-based branch name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const suffix = generateId()
      branchName = `agent/${timestamp}-${suffix}`

      await logger.info(`Creating timestamp-based branch: ${branchName}`)
      const createBranch = await container.runCommand('git', ['checkout', '-b', branchName])

      if (!createBranch.success) {
        throw new Error(`Failed to create branch ${branchName}`)
      }
    }

    await logger.info('Docker sandbox ready for agent execution')

    return {
      success: true,
      sandbox: container as any, // Type casting - we'll handle this in the agent execution
      domain: 'localhost', // Docker containers run locally
      branchName,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Docker sandbox creation error:', error)
    await logger.error(`Error: ${errorMessage}`)

    // Cleanup container on error
    if (container) {
      try {
        await container.destroy()
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      success: false,
      error: errorMessage || 'Failed to create Docker sandbox',
    }
  }
}
