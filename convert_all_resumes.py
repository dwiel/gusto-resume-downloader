#!/usr/bin/env python3
import subprocess
from pathlib import Path

def main():
    pdf_dir = Path("./downloaded-resumes")
    pdf_files = list(pdf_dir.glob("*.pdf"))
    
    if not pdf_files:
        print("No PDF files found")
        return
    
    # Count files
    need_conversion = [pdf for pdf in pdf_files if not pdf.with_suffix('.md').exists()]
    
    print(f"Total PDFs: {len(pdf_files)}")
    print(f"Already converted: {len(pdf_files) - len(need_conversion)}")
    print(f"Need conversion: {len(need_conversion)}\n")
    
    # Convert each PDF
    for i, pdf in enumerate(need_conversion, 1):
        print(f"[{i}/{len(need_conversion)}] Converting {pdf.name}...", end='', flush=True)
        try:
            subprocess.run([
                "docling", "--to", "md", "--output", str(pdf_dir), str(pdf)
            ], capture_output=True, check=True)
            print(" ✅")
        except subprocess.CalledProcessError as e:
            print(f" ❌ Error: {e.stderr.decode().strip()}")

if __name__ == "__main__":
    main()