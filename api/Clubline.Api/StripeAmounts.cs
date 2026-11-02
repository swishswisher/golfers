namespace Clubline;
// Internal ledgers keep normal currency minor units. Stripe retains a legacy
// two-decimal representation for these otherwise whole-unit currencies.
public static class StripeAmounts
{
    public static long ToProvider(long minor, string currency) => currency.ToUpperInvariant() is "ISK" or "UGX" ? checked(minor * 100) : minor;
    public static long FromProvider(long minor, string currency)
    {
        if (currency.ToUpperInvariant() is not ("ISK" or "UGX")) return minor;
        Rules.Check(minor % 100 == 0, "The provider amount requires financial review.", 409);
        return minor / 100;
    }
}
