export async function time<T>(name: string, f: () => T): Promise<T> {

    let timeStart = new Date().getTime()

    process.stdout.write(`Starting task ${name}: `)
    let res  = await f()
    const ms = (new Date().getTime() - timeStart) + 'ms'
    process.stdout.write(`${ms}ms\n`)

    return res
}