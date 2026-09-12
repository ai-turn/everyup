package discovery

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
)

// Docker multiplexes non-TTY stdout/stderr using eight-byte frame headers.
// Decode incrementally rather than cutting the HTTP body in the middle of a
// frame. A truncated frame is an error and must never advance the log cursor.
type dockerStreamReader struct {
	r         *bufio.Reader
	remaining uint32
}

func (r *dockerStreamReader) Read(p []byte) (int, error) {
	for r.remaining == 0 {
		var header [8]byte
		if _, err := io.ReadFull(r.r, header[:]); err != nil {
			return 0, err
		}
		if (header[0] != 1 && header[0] != 2) || header[1] != 0 || header[2] != 0 || header[3] != 0 {
			return 0, fmt.Errorf("invalid Docker log frame")
		}
		r.remaining = binary.BigEndian.Uint32(header[4:])
	}
	if uint64(len(p)) > uint64(r.remaining) {
		p = p[:int(r.remaining)]
	}
	n, err := r.r.Read(p)
	r.remaining -= uint32(n)
	if err == io.EOF && r.remaining > 0 {
		err = io.ErrUnexpectedEOF
	}
	return n, err
}

func readDockerLogs(source io.Reader, visit func(DockerLogLine) error) error {
	buffered := bufio.NewReader(source)
	var decoded io.Reader = buffered
	if prefix, _ := buffered.Peek(4); len(prefix) == 4 && (prefix[0] == 1 || prefix[0] == 2) && prefix[1] == 0 && prefix[2] == 0 && prefix[3] == 0 {
		decoded = &dockerStreamReader{r: buffered}
	}
	reader := bufio.NewReader(decoded)
	// Retain a bounded prefix, including the Docker timestamp. Drain the rest
	// of an oversized line before handing it off; the agent caps the log body.
	const maxPrefix = 64 << 10
	line := make([]byte, 0, 8192)
	for {
		part, err := reader.ReadSlice('\n')
		keep := min(len(part), maxPrefix-len(line))
		line = append(line, part[:keep]...)
		if err == bufio.ErrBufferFull {
			continue
		}
		if err != nil && err != io.EOF {
			return fmt.Errorf("read Docker log: %w", err)
		}
		if len(line) > 0 {
			for _, entry := range parseDockerLogLines(line) {
				if err := visit(entry); err != nil {
					return err
				}
			}
		}
		line = line[:0]
		if err == io.EOF {
			return nil
		}
	}
}
