import { File, Paths } from 'expo-file-system';

let tempFileSequence = 0;

export class KeyValueStore {
  async getItem(key: string): Promise<string | undefined> {
    const file = getFile(key);
    if (file.exists) {
      return file.text();
    }
    return undefined;
  }

  async getItemBytes(key: string): Promise<Uint8Array | undefined> {
    const file = getFile(key);
    if (file.exists) {
      return this.readBytes(file);
    }
    return undefined;
  }

  async setItem(key: string, value: string | Uint8Array): Promise<void> {
    // Write to a unique temporary file first so an interrupted write cannot
    // corrupt the previous value. Temp filenames do not need cryptographic
    // UUIDs; timestamp + process-local sequence is enough and keeps ordinary
    // preference persistence independent from the crypto subsystem.
    const tempFile = getTempFile(key);
    const finalFile = getFile(key);
    tempFile.create();

    if (typeof value === 'string') {
      tempFile.write(value);
      if (finalFile.exists) {
        finalFile.delete();
      }
      await tempFile.move(finalFile, { overwrite: true });
      return;
    }
    const stream = tempFile.writableStream();
    const writer = stream.getWriter();
    try {
      await writer.write(value);
    } finally {
      await writer.close();
    }
    if (finalFile.exists) {
      finalFile.delete();
    }
    await tempFile.move(finalFile, { overwrite: true });
  }

  getItemSync(key: string): string | undefined {
    const file = getFile(key);
    if (file.exists) {
      return file.textSync();
    }
    return undefined;
  }

  async removeItem(key: string): Promise<void> {
    const file = getFile(key);
    if (file.exists) {
      file.delete();
    }
  }

  private async readBytes(file: File): Promise<Uint8Array> {
    return file.bytes();
  }
}

function getTempFile(key: string): File {
  tempFileSequence = (tempFileSequence + 1) % Number.MAX_SAFE_INTEGER;
  return getFile(
    `${key}-tmp-${Date.now().toString(36)}-${tempFileSequence.toString(36)}`,
  );
}

function getFile(key: string): File {
  return new File(Paths.join(Paths.document, key));
}
