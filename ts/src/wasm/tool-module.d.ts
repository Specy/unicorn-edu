/** The part of an Emscripten program module (a binutils tool) this package uses. */
export interface ToolFS {
    writeFile(path: string, data: string | Uint8Array): void
    readFile(path: string): Uint8Array
    mkdirTree(path: string): void
    analyzePath(path: string): { exists: boolean }
    chdir(path: string): void
}

export interface ToolModule {
    FS: ToolFS
    callMain(args: string[]): number
}

export interface ToolModuleOptions {
    print?: (line: string) => void
    printErr?: (line: string) => void
    thisProgram?: string
    instantiateWasm?: (
        imports: WebAssembly.Imports,
        receiveInstance: (instance: WebAssembly.Instance, module?: WebAssembly.Module) => void,
    ) => WebAssembly.Exports | Record<string, never>
}

export type ToolModuleFactory = (options?: ToolModuleOptions) => Promise<ToolModule>
