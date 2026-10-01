from pathlib import Path
import shutil


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CLEANUP_DIRECTORIES = (
    PROJECT_ROOT / "uploads",
    PROJECT_ROOT / "outputs",
)


def cleanup_directories() -> dict[str, int]:
    """Remove generated files while preserving the uploads and outputs folders."""
    removed_entries = {}

    for directory in CLEANUP_DIRECTORIES:
        directory.mkdir(parents=True, exist_ok=True)
        removed = 0

        for entry in directory.iterdir():
            if entry.is_symlink() or entry.is_file():
                entry.unlink()
            elif entry.is_dir():
                shutil.rmtree(entry)
            removed += 1

        removed_entries[directory.name] = removed

    return removed_entries


if __name__ == "__main__":
    for directory, count in cleanup_directories().items():
        print(f"Removed {count} entries from {directory}/")
