#!/usr/bin/env python3
import os
import random
import subprocess
import difflib
import sys
from pathlib import Path

def get_random_pdf():
    """Get a random PDF from the downloaded-resumes directory."""
    pdf_dir = Path("./downloaded-resumes")
    if not pdf_dir.exists():
        print("Error: downloaded-resumes directory not found")
        sys.exit(1)
    
    pdf_files = list(pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print("Error: No PDF files found in downloaded-resumes directory")
        sys.exit(1)
    
    return random.choice(pdf_files)

def convert_with_markitdown(pdf_path, output_path):
    """Convert PDF using markitdown."""
    print(f"Converting with markitdown...")
    try:
        subprocess.run([
            "markitdown", str(pdf_path), "-o", str(output_path)
        ], check=True, capture_output=True, text=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error with markitdown: {e}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        return False

def convert_with_docling(pdf_path, output_dir):
    """Convert PDF using docling."""
    print(f"Converting with docling...")
    try:
        subprocess.run([
            "docling", "--to", "md", "--output", str(output_dir), str(pdf_path)
        ], check=True, capture_output=True, text=True)
        
        # Docling creates output file with .md extension in the output directory
        docling_output = output_dir / f"{pdf_path.stem}.md"
        if docling_output.exists():
            return True
        else:
            print(f"Error: Docling output file not found at {docling_output}")
            return False
    except subprocess.CalledProcessError as e:
        print(f"Error with docling: {e}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        return False

def show_diff(file1_path, file2_path):
    """Show a unified diff between two files."""
    with open(file1_path, 'r', encoding='utf-8', errors='ignore') as f1:
        lines1 = f1.readlines()
    
    with open(file2_path, 'r', encoding='utf-8', errors='ignore') as f2:
        lines2 = f2.readlines()
    
    diff = difflib.unified_diff(
        lines1, lines2,
        fromfile='markitdown output',
        tofile='docling output',
        lineterm=''
    )
    
    return '\n'.join(diff)

def main():
    # Get random PDF
    pdf_path = get_random_pdf()
    print(f"\nSelected PDF: {pdf_path.name}")
    print("=" * 80)
    
    # Create output directory
    output_dir = Path("./pdf-comparison")
    output_dir.mkdir(exist_ok=True)
    
    # Convert with markitdown
    markitdown_output = output_dir / "markitdown_output.md"
    if not convert_with_markitdown(pdf_path, markitdown_output):
        print("Failed to convert with markitdown")
        return
    
    # Convert with docling
    docling_output_dir = output_dir / "docling"
    docling_output_dir.mkdir(exist_ok=True)
    if not convert_with_docling(pdf_path, docling_output_dir):
        print("Failed to convert with docling")
        return
    
    # Find the actual docling output file
    docling_output = docling_output_dir / f"{pdf_path.stem}.md"
    
    print("\n" + "=" * 80)
    print("CONVERSION COMPLETE")
    print("=" * 80)
    
    # Show file sizes
    markitdown_size = markitdown_output.stat().st_size
    docling_size = docling_output.stat().st_size
    print(f"\nFile sizes:")
    print(f"  markitdown: {markitdown_size:,} bytes")
    print(f"  docling:    {docling_size:,} bytes")
    
    # Show first 50 lines of each output
    print("\n" + "=" * 80)
    print("MARKITDOWN OUTPUT (first 50 lines):")
    print("=" * 80)
    with open(markitdown_output, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()[:50]
        print(''.join(lines))
    
    print("\n" + "=" * 80)
    print("DOCLING OUTPUT (first 50 lines):")
    print("=" * 80)
    with open(docling_output, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()[:50]
        print(''.join(lines))
    
    # Show diff
    print("\n" + "=" * 80)
    print("DIFF (first 100 lines):")
    print("=" * 80)
    diff = show_diff(markitdown_output, docling_output)
    diff_lines = diff.split('\n')[:100]
    print('\n'.join(diff_lines))
    
    # Save full outputs for manual inspection
    print(f"\n\nFull outputs saved to:")
    print(f"  markitdown: {markitdown_output}")
    print(f"  docling:    {docling_output}")

if __name__ == "__main__":
    main()