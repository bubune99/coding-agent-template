import { DockerContainer } from './container'
import { TaskLogger } from '@/lib/utils/task-logger'

export type PackageManager = 'npm' | 'yarn' | 'pnpm'

/**
 * Detect which package manager the project uses
 */
export async function detectPackageManager(container: DockerContainer, logger: TaskLogger): Promise<PackageManager> {
  await logger.info('Detecting package manager...')

  // Check for pnpm-lock.yaml
  const pnpmLockCheck = await container.runCommand('test', ['-f', 'pnpm-lock.yaml'])
  if (pnpmLockCheck.success) {
    await logger.info('Detected pnpm (pnpm-lock.yaml found)')
    return 'pnpm'
  }

  // Check for yarn.lock
  const yarnLockCheck = await container.runCommand('test', ['-f', 'yarn.lock'])
  if (yarnLockCheck.success) {
    await logger.info('Detected yarn (yarn.lock found)')
    return 'yarn'
  }

  // Check for package-lock.json
  const npmLockCheck = await container.runCommand('test', ['-f', 'package-lock.json'])
  if (npmLockCheck.success) {
    await logger.info('Detected npm (package-lock.json found)')
    return 'npm'
  }

  // Default to npm
  await logger.info('No lock file found, defaulting to npm')
  return 'npm'
}

/**
 * Install dependencies using detected package manager
 */
export async function installDependenciesDocker(
  container: DockerContainer,
  packageManager: PackageManager,
  logger: TaskLogger,
): Promise<{ success: boolean }> {
  await logger.info(`Installing dependencies with ${packageManager}...`)

  // Install package manager globally if needed
  if (packageManager === 'pnpm') {
    const pnpmCheck = await container.runCommand('which', ['pnpm'])
    if (!pnpmCheck.success) {
      await logger.info('Installing pnpm globally...')
      const pnpmInstall = await container.runCommand('npm', ['install', '-g', 'pnpm'])
      if (!pnpmInstall.success) {
        await logger.error('Failed to install pnpm globally')
        return { success: false }
      }
    }
  } else if (packageManager === 'yarn') {
    const yarnCheck = await container.runCommand('which', ['yarn'])
    if (!yarnCheck.success) {
      await logger.info('Installing yarn globally...')
      const yarnInstall = await container.runCommand('npm', ['install', '-g', 'yarn'])
      if (!yarnInstall.success) {
        await logger.error('Failed to install yarn globally')
        return { success: false }
      }
    }
  }

  // Install dependencies
  const installCommand = packageManager === 'npm' ? 'install' : packageManager === 'yarn' ? 'install' : 'install'

  const installResult = await container.runCommand(packageManager, [installCommand])

  if (installResult.success) {
    await logger.info(`Dependencies installed successfully with ${packageManager}`)
    return { success: true }
  } else {
    await logger.error(`Failed to install dependencies with ${packageManager}`)
    if (installResult.error) {
      await logger.error(`Error: ${installResult.error}`)
    }
    return { success: false }
  }
}
