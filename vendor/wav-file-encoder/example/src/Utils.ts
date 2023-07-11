export function catchError (f: Function, ...args: any[]) {
   void catchErrorAsync(f, ...args); }

async function catchErrorAsync (f: Function, ...args: any[]) {
   try {
      const r = f(...args);
      if (r instanceof Promise) {
         await r; }}
    catch (error) {
      console.log(error);
      alert("Error: " + error); }}

export function openSaveAsDialog (data: ArrayBuffer, fileName: string, mimeType: string, fileNameExtension: string, fileTypeDescription: string) {
   if ((<any>window).showSaveFilePicker) {
      catchError(openSaveAsDialog_new, data, fileName, mimeType, fileNameExtension, fileTypeDescription); }
    else {
      openSaveAsDialog_old(data, fileName, mimeType); }}

async function openSaveAsDialog_new (data: ArrayBuffer, fileName: string, mimeType: string, fileNameExtension: string, fileTypeDescription: string) {
   const fileTypeDef: any = {};
   fileTypeDef[mimeType] = ["." + fileNameExtension];
   const pickerOpts = {
      suggestedName: fileName,
      types: [{
         description: fileTypeDescription,
         accept: fileTypeDef }]};
   let fileHandle: FileSystemFileHandle;
   try {
      fileHandle = await (<any>window).showSaveFilePicker(pickerOpts); }
    catch (e) {
      if (e.name == "AbortError") {
         return; }
      throw e; }
   const stream /* : FileSystemWritableFileStream */ = await (<any>fileHandle).createWritable();
   await stream.write(data);
   await stream.close(); }

function openSaveAsDialog_old (data: ArrayBuffer, fileName: string, mimeType: string) {
   const blob = new Blob([data], {type: mimeType});
   const url = URL.createObjectURL(blob);
   const element = document.createElement("a");
   element.href = url;
   element.download = fileName;
   const clickEvent = new MouseEvent("click");
   element.dispatchEvent(clickEvent);
   setTimeout(() => URL.revokeObjectURL(url), 60000);
   (<any>document).dummySaveAsElementHolder = element; }   // to prevent garbage collection

export function getRadioButtonGroupValue (name: string) : string | undefined {
   const a = document.getElementsByName(name);
   for (let i = 0; i < a.length; i++) {
      const e = <HTMLInputElement>a[i];
      if (e.checked) {
         return e.value; }}
   return undefined; }
