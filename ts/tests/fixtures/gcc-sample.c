int __asm_editor_main(void);
#line 1 "main.c"
static const char *names[] = {"zero", "one", "two"};
int table[8];
double scale = 1.5;

static int fib(int n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }

int pick(int k) {
    switch (k) {
    case 0: return 10;
    case 1: return 20;
    case 2: return 33;
    case 3: return 47;
    case 4: return 51;
    default: return -1;
    }
}

int main(void) {
    int s = 0;
    for (int i = 0; i < 8; i++) { table[i] = fib(i) * pick(i % 6); s += table[i]; }
    s += (int)(scale * s) + names[1][0];
    return s;
}
