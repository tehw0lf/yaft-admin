import { Directive, EventEmitter, HostBinding, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[appDragDrop]',
  standalone: true
})
export class DragDropDirective {
  @Output() filesDropped = new EventEmitter<FileList>();
  @Output() dragOver = new EventEmitter<boolean>();

  @HostBinding('class.drag-over')
  public isDraggedOver = false;

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggedOver = true;
    this.dragOver.emit(true);
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Only set to false if we're actually leaving the element
    const target = event.currentTarget as HTMLElement;
    const relatedTarget = event.relatedTarget as HTMLElement;
    
    if (!target.contains(relatedTarget)) {
      this.isDraggedOver = false;
      this.dragOver.emit(false);
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.isDraggedOver = false;
    this.dragOver.emit(false);
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      // Validate file types (JSON and CSV only)
      const validFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (this.isValidFileType(file)) {
          validFiles.push(file);
        }
      }
      
      if (validFiles.length > 0) {
        // Convert to FileList-like object
        const fileList = this.createFileList(validFiles);
        this.filesDropped.emit(fileList);
      }
    }
  }

  private isValidFileType(file: File): boolean {
    const allowedTypes = ['.json', '.csv'];
    const fileName = file.name.toLowerCase();
    return allowedTypes.some(type => fileName.endsWith(type)) || 
           file.type === 'application/json' || 
           file.type === 'text/csv' ||
           file.type === 'application/csv';
  }

  private createFileList(files: File[]): FileList {
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    return dt.files;
  }
}